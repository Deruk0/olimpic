const paths = {
  chevronDown: "m6 9 6 6 6-6",
  search: "M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  schedule: "M4 6h16v14H4zM4 10h16M8 4v4m8-4v4m-8 6h2m4 0h2m-8 3h2",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2",
  profile: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2",
  microphone: "M9 6a3 3 0 0 1 6 0v6a3 3 0 1 1-6 0ZM5 11v1a7 7 0 0 0 14 0v-1m-7 8v3m-3 0h6",
  camera: "M3 6h12v12H3zm12 4 6-3v10l-6-3",
  screen: "M3 4h18v13H3zm9 13v4m-4 0h8",
  homework: "M8 4h8m-9 1H5v15h14V5h-2M8 9h8m-8 4h8m-8 4h5",
  plan: "M5 19v-4l5-5 4 4 5-8m-5 0h5v5M4 20h16",
  course: "M4 20h16M7 16v-4m5 4V8m5 8V4",
  groups: "M3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2m2-6a4 4 0 0 1 4 4v2M12 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm4-3a3 3 0 1 1 0 6",
  library: "M4 5h5v15H4zm5 0h5v15h-5zm6 1 4-1 3 14-4 1z",
  image: "M4 5h16v14H4zM4 16l4-4 3 3 3-4 6 6M15 9h.01",
  theory: "M12 6v15m0-15C9 4 6 4 3 5v14c3-1 6-1 9 2 3-3 6-3 9-2V5c-3-1-6-1-9 1Z",
  review: "M9 5H5v15h14v-7M9 11l3 3 8-8",
  logout: "M11 5H5v14h6m2-7h8m-3-3 3 3-3 3",
};

export type InterfaceIconName = keyof typeof paths;

export function InterfaceIcon({ name }: { name: InterfaceIconName }) {
  return <svg className="interface-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

