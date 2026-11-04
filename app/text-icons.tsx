const paths: Record<string,string> = {
  "align-left":"M3 5h18M3 10h12M3 15h18M3 20h12",
  "align-center":"M3 5h18M6 10h12M3 15h18M6 20h12",
  "align-right":"M3 5h18M9 10h12M3 15h18M9 20h12",
  B:"M6 4h7a4 4 0 0 1 0 8H6m0-8v16h8a4 4 0 0 0 0-8H6", I:"M10 4h9M5 20h9m2-16L8 20", U:"M6 4v7a6 6 0 0 0 12 0V4M4 21h16", S:"M18 6c-3-4-12-3-12 2s12 2 12 8-9 6-12 2M3 12h18",
  "▰":"m5 16 10-11 4 4L9 20H5zM3 22h18", H1:"M4 4v16m8-16v16M4 12h8m4-3 3-2v13", H2:"M3 4v16m8-16v16M3 12h8m4-2c0-5 7-4 6 0s-6 6-6 10h6",
  "•":"M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1", "1.":"M10 6h11M10 12h11M10 18h11M3 4l2-1v6M3 14c0-2 4-2 4 0s-4 3-4 5h4",
  "☑":"M10 6h11M10 18h11M2 5l2 2 3-4M2 15h5v5H2z", "❝":"M3 6h7v6H5l-2 6m11-12h7v6h-5l-2 6", link:"M10 13l4-4m-7 6-2 2a4 4 0 0 0 6 6l4-4a4 4 0 0 0 0-6m2-4 2-2a4 4 0 0 0-6-6L9 5a4 4 0 0 0 0 6",
  table:"M3 4h18v16H3zM3 10h18M3 15h18M12 4v16", file:"m8 13 7-7a2 2 0 0 1 3 3l-9 9a4 4 0 0 1-6-6l9-9a6 6 0 0 1 9 8l-9 9",
  preview:"M2 12c6-9 14-9 20 0-6 9-14 9-20 0zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6", edit:"m4 16 12-12 4 4L8 20H4z",
  left:"M3 4h18M3 20h18m-9-10h9m-9 4h9M8 8l-4 4 4 4", right:"M3 4h18M3 20h18m-9-10h9m-9 4h9M4 8l4 4-4 4"
};
export function TextIcon({ name }: {name:string}) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]}/></svg>;
}
