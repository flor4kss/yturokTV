import ChannelSidebar from "./ChannelSidebar";
import LiveSidebar from "./LiveSidebar";
import VideoStage from "./VideoStage";
import NowPlayingCard from "./NowPlayingCard";
export default function TVWorkspace() {
  return (
    <main className={"flex-1 min-h-0 flex gap-3 p-3 overflow-hidden"}>
      <ChannelSidebar />
      <section className={"flex-1 flex flex-col min-w-0 min-h-0 gap-2.5"}>
        <VideoStage />
        <NowPlayingCard />
      </section>
      <LiveSidebar />
    </main>
  );
}
