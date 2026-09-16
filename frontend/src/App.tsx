import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Home from "./pages/Home";
import Architecture from "./pages/Architecture";
import ReportMapping from "./pages/ReportMapping";
import PacketCaptureGuide from "./pages/PacketCaptureGuide";
import VivaMode from "./pages/VivaMode";
import About from "./pages/About";
import ExperimentLab from "./pages/ExperimentLab";
import TcpVsUdp from "./pages/TcpVsUdp";
import AbrLab from "./pages/AbrLab";
import LiveSimulation from "./pages/LiveSimulation";
import Results from "./pages/Results";
import WhatIf from "./pages/WhatIf";
import ExperimentHistory from "./pages/ExperimentHistory";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/architecture" element={<Architecture />} />
        <Route path="/report-mapping" element={<ReportMapping />} />
        <Route path="/packet-capture-guide" element={<PacketCaptureGuide />} />
        <Route path="/viva" element={<VivaMode />} />
        <Route path="/about" element={<About />} />
        <Route path="/experiment-lab" element={<ExperimentLab />} />
        <Route path="/tcp-vs-udp" element={<TcpVsUdp />} />
        <Route path="/abr-lab" element={<AbrLab />} />
        <Route path="/live-simulation" element={<LiveSimulation />} />
        <Route path="/results" element={<Results />} />
        <Route path="/what-if" element={<WhatIf />} />
        <Route path="/experiment-history" element={<ExperimentHistory />} />
      </Route>
    </Routes>
  );
}
