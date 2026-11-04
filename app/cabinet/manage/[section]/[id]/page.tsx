import { renderCabinet, type CabinetQuery } from "../../../view";
export default async function ManageDetail({ params, searchParams }: {
  params: Promise<{ section: string; id: string }>; searchParams: Promise<CabinetQuery>;
}) {
  const [{ section, id }, query] = await Promise.all([params, searchParams]);
  return renderCabinet({ ...query, view: section }, id);
}
