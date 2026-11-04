import { renderCabinet, type CabinetQuery } from "./view";
export default async function Cabinet({ searchParams }: { searchParams: Promise<CabinetQuery> }) {
  return renderCabinet(await searchParams);
}
