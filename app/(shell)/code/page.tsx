import Designed from "@/components/Designed";
export default function Code() {
  return (
    <Designed
      screen="e5-repository-browser"
      board="E5"
      title="Code and compute"
      missing="Needs a Git host and a compute backend. The reproducibility badge is only meaningful once a run can actually be executed."
    />
  );
}
