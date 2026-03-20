import AssetDetailsClient from "./AssetDetailsClient";

export function generateStaticParams() {
  return [{ id: ['fallback'] }];
}

export default function AssetDetailsPage() {
  return <AssetDetailsClient />;
}
