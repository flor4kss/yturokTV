// IDs belong to the editorial catalogue, never to a stream URL.
export const seriesId = item => item.seriesKey || item.title;
export const isEligible = item => item.type !== 'rutube' && (item.airStatus === 'ready' || item.airStatus === 'legacy');
export function orderedSeries(channel) {
  const groups = new Map();
  for (const item of channel.schedule) {
    if (item.type === 'bumper' || item.sourceOffset) continue;
    const key = seriesId(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  for (const [key, episodes] of groups) {
    episodes.sort((a,b) => (a.seasonOrder || 0)-(b.seasonOrder || 0) || (a.ordinal || 0)-(b.ordinal || 0));
    const independent = episodes.every(e => e.continuity === 'episodic');
    if (independent) groups.set(key, episodes.filter(isEligible));
    else {
      const contiguous=[];
      let previous;
      for (const episode of episodes) {
        if(previous) {
          const sameSeason=(episode.seasonOrder || 0)===(previous.seasonOrder || 0);
          const gap=sameSeason && Number.isFinite(previous.ordinal) && Number.isFinite(episode.ordinal) && episode.ordinal!==previous.ordinal+1;
          const seasonGap=(episode.seasonOrder || 0)>(previous.seasonOrder || 0)+1;
          if(gap || seasonGap) {
            contiguous.push({episodeId:`gap:${episode.episodeId}`,airStatus:'excluded',exclusionReason:'Missing preceding episode',type:'placeholder'});
            break;
          }
        }
        contiguous.push(episode); previous=episode;
        if(!isEligible(episode))break;
      }
      groups.set(key,contiguous);
    }
    // Keep a failed entry as a barrier. Do not wrap before a known story gap.
  }
  return groups;
}
export function nextRound(groups, cursors, round, previousSeries) {
  const available = [...groups.keys()].filter(key => {
    const episodes = groups.get(key), cursor = cursors[key] || 0;
    const barrier=episodes.findIndex(e=>!isEligible(e));
    if(barrier>=0 && cursor>=barrier)return false;
    return episodes.length && isEligible(episodes[cursor % episodes.length]);
  });
  if (!available.length) return [];
  const shift = round % available.length;
  const order = [...available.slice(shift), ...available.slice(0, shift)];
  if (order.length > 1 && order[0] === previousSeries) order.push(order.shift());
  return order.map(key => {
    const episodes = groups.get(key), cursor = cursors[key] || 0;
    cursors[key] = cursor + 1;
    return {...episodes[cursor % episodes.length], repeat: cursor >= episodes.length};
  });
}
