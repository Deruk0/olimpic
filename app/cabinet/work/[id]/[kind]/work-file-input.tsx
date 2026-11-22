"use client";

import { useEffect, useRef, useState } from "react";
import { InterfaceIcon } from "../../../../interface-icons";
import { ScrollArea } from "../../../../scroll-area";

function FilePreview({ file }: { file: File }) {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => {
    if (!["image/jpeg", "image/png"].includes(file.type)) return;
    const url = URL.createObjectURL(file);
    setPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return preview?.file === file ? <img src={preview.url} alt="" /> : <InterfaceIcon name="image" />;
}

export function WorkFileInput({ index }: { index: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

  function remove(position: number) {
    if (!input.current) return;
    const remaining = files.filter((_, fileIndex) => fileIndex !== position);
    const transfer = new DataTransfer();
    remaining.forEach(file => transfer.items.add(file));
    input.current.files = transfer.files;
    setFiles(remaining);
  }

  return <div className="work-files">
    <ScrollArea label="Прикреплённые решения" className="work-file-list" viewportClassName="work-file-viewport">
      {files.length ? <ul>{files.map((file, position) => <li key={position + ":" + file.name}>
        <FilePreview file={file} /><span>{file.name}</span>
        <button className="secondary" type="button" onClick={() => remove(position)} aria-label={"Убрать файл «" + file.name + "»"}>×</button>
      </li>)}</ul> : <p className="muted">Решение ещё не прикреплено.</p>}
    </ScrollArea>
    <label className="work-file-picker">Прикрепить решение
      <input ref={input} type="file" name={"file." + index} accept=".pdf,.jpg,.jpeg,.png" multiple required
        aria-describedby="work-file-limits" onChange={event => setFiles(Array.from(event.currentTarget.files ?? []))} />
    </label>
    <small id="work-file-limits">PDF, JPEG или PNG. До 3 файлов на задачу, 6 МБ на файл и 24 МБ на работу.</small>
  </div>;
}
