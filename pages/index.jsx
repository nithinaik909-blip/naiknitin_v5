import dynamic from "next/dynamic";
const App = dynamic(() => import("../components/vision_ai_studio_v4"), { ssr: false });
export default function Home() {
  return <App />;
}
