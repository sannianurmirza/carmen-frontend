import RencanaMenuEditorPage from "./RencanaMenuDetailClient";

export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function Page() {
  return <RencanaMenuEditorPage />;
}
