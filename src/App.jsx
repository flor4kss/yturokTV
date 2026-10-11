import AppHeader from "./components/AppHeader.jsx";
import TVWorkspace from "./components/TVWorkspace.jsx";
import EPGModal from "./components/EPGModal.jsx";
import AdminModal from "./components/AdminModal.jsx";
export default function App() {
  return (
    <>
      <AppHeader />
      <TVWorkspace />
      <EPGModal />
      <AdminModal />
    </>
  );
}
