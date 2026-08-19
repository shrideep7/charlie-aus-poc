import { Charli } from "@/components/Charli";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // ?rails=1 starts in deterministic playback — stage insurance.
  const rails = params.rails === "1" || params.rails === "true";
  return <Charli initialRails={rails} />;
}
