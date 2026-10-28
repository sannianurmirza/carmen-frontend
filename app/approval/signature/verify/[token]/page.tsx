import SignatureVerificationPage from "./SignatureVerifyClient";

export function generateStaticParams() {
  return [{ token: "preview" }];
}

export default function Page() {
  return <SignatureVerificationPage />;
}
