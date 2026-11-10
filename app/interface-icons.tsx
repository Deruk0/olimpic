const paths = {
  dev: "M8 7 3 12l5 5m8-10 5 5-5 5M14 4l-4 16",
  search: "M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  schedule: "M4 6h16v14H4zM4 10h16M8 4v4m8-4v4m-8 6h2m4 0h2m-8 3h2",
  homework: "M8 4h8m-9 1H5v15h14V5h-2M8 9h8m-8 4h8m-8 4h5",
  plan: "M5 19v-4l5-5 4 4 5-8m-5 0h5v5M4 20h16",
  course: "M4 20h16M7 16v-4m5 4V8m5 8V4",
  groups: "M3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2m2-6a4 4 0 0 1 4 4v2M12 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm4-3a3 3 0 1 1 0 6",
  library: "M4 5h5v15H4zm5 0h5v15h-5zm6 1 4-1 3 14-4 1z",
  programs: "M12 6v15m0-15C9 4 6 4 3 5v14c3-1 6-1 9 2 3-3 6-3 9-2V5c-3-1-6-1-9 1Z",
  review: "M9 5H5v15h14v-7M9 11l3 3 8-8",
  logout: "M11 5H5v14h6m2-7h8m-3-3 3 3-3 3",
};

export type InterfaceIconName = keyof typeof paths;

export function InterfaceIcon({ name }: { name: InterfaceIconName }) {
  return <svg className="interface-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

