import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Expand,
  Gamepad2,
  Heart,
  LayoutGrid,
  LoaderCircle,
  MessageCircle,
  Moon,
  Music2,
  Palette,
  Play,
  Radio,
  RectangleHorizontal,
  RotateCcw,
  Search,
  Send,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Tv,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
const icons = {
  wide: RectangleHorizontal,
  arrowDown: ArrowDown,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  arrowUp: ArrowUpRight,
  audio: AudioLines,
  bell: Bell,
  check: Check,
  down: ChevronDown,
  left: ChevronLeft,
  right: ChevronRight,
  clock: Clock3,
  expand: Expand,
  game: Gamepad2,
  heart: Heart,
  grid: LayoutGrid,
  loader: LoaderCircle,
  chat: MessageCircle,
  moon: Moon,
  music: Music2,
  palette: Palette,
  play: Play,
  radio: Radio,
  restart: RotateCcw,
  search: Search,
  send: Send,
  settings: Settings2,
  sliders: SlidersHorizontal,
  sparkles: Sparkles,
  sun: Sun,
  tv: Tv,
  volume: Volume2,
  muted: VolumeX,
  close: X,
};
export default function Icon({ name, size = 20, className = "", ...props }) {
  const Component = icons[name] || Tv;
  return (
    <Component
      size={size}
      strokeWidth={1.8}
      aria-hidden="true"
      className={className}
      {...props}
    />
  );
}
export const categoryIcon = (category) =>
  ({
    anime: "sparkles",
    cartoons: "palette",
    minecrafters: "game",
    music: "music",
  })[category] || "tv";
