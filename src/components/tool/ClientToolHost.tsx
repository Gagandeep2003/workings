"use client";
import dynamic from "next/dynamic";
import type { ClientComponent } from "@/tools/types";

/**
 * Browser-only tools (images, PDFs, QR codes). Each interface is loaded on demand, so the PDF and image libraries are
 * only downloaded by visitors who open one of these tools. They are never rendered on the server (they use the File,
 * Canvas and Blob APIs), but the page around them is, so the explanation, specs and FAQs are plain crawlable HTML.
 */
function Loading() {
  return (
    <div className="card file-tool file-tool--loading" role="status" aria-live="polite">
      <p>Loading the tool…</p>
    </div>
  );
}

const COMPONENTS: Record<ClientComponent, React.ComponentType<{ preset?: string }>> = {
  "image-compressor": dynamic(() => import("../files/ImageCompressor"), { ssr: false, loading: Loading }),
  "image-converter": dynamic(() => import("../files/ImageConverter"), { ssr: false, loading: Loading }),
  "image-resizer": dynamic(() => import("../files/ImageResizer"), { ssr: false, loading: Loading }),
  "photo-resizer": dynamic(() => import("../files/PhotoResizer"), { ssr: false, loading: Loading }),
  "jpg-to-pdf": dynamic(() => import("../files/JpgToPdf"), { ssr: false, loading: Loading }),
  "pdf-merge": dynamic(() => import("../files/PdfMerge"), { ssr: false, loading: Loading }),
  "pdf-split": dynamic(() => import("../files/PdfSplit"), { ssr: false, loading: Loading }),
  "pdf-compress": dynamic(() => import("../files/PdfCompress"), { ssr: false, loading: Loading }),
  "qr-generator": dynamic(() => import("../files/QrGenerator"), { ssr: false, loading: Loading }),
};

export function ClientToolHost({ component, preset }: { component: ClientComponent; preset?: string }) {
  const Component = COMPONENTS[component];
  return <Component preset={preset} />;
}
