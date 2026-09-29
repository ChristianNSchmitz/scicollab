import Designed from "@/components/Designed";
export default function Institution() {
  return (
    <Designed
      screen="i1-admin-console-home"
      board="I1"
      title="Institution console"
      missing="Needs SSO, SCIM provisioning and a tenant model. Note board K5 question 9: per-researcher metrics must never be obtainable, which shapes every dashboard here."
    />
  );
}
