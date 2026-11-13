"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Shop } from "@/lib/types";
import Modal from "./Modal";
import DialogHeader from "./DialogHeader";

type Props = { open: boolean; shop: Shop; onClose: () => void; onSaved: (shop: Shop) => void };

export default function SettingsDialog(props: Props) {
  return (
    <Modal open={props.open} onClose={props.onClose} id="settingsDlg">
      <SettingsForm {...props} />
    </Modal>
  );
}

/** Shrink the logo before upload (max 512 px, PNG keeps transparency). */
function resizeImage(file: File, max = 512): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't a valid image.")); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process the image."))), "image/png");
    };
    img.src = url;
  });
}

function SettingsForm({ shop, onClose, onSaved }: Props) {
  const [f, setF] = useState({
    name: shop.name, slogan: shop.slogan, address: shop.address, phone: shop.phone,
    email: shop.email, website: shop.website, terms: shop.terms,
  });
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null);   // new logo waiting to upload
  const [removeLogo, setRemoveLogo] = useState(false);
  const [preview, setPreview] = useState<string | null>(shop.logo_url);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  // Free object URLs created for the preview.
  useEffect(() => () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);

  async function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const blob = await resizeImage(file);
      setLogoBlob(blob);
      setRemoveLogo(false);
      setPreview(URL.createObjectURL(blob));
      setError("");
    } catch (err) {
      setError((err as Error).message);
      e.target.value = "";
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (removeLogo && shop.logo_url) await api.removeLogo();
      if (logoBlob) await api.uploadLogo(logoBlob);
      onSaved(await api.saveShop(f));
    } catch (err) {
      setError(`Save failed: ${(err as Error).message}`);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <DialogHeader title="Shop Settings" onClose={onClose} />
      <div className="dlg-body">
        <div className="section-title full">Shop details</div>
        <div className="full logo-row">
          <div className="logo-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {preview ? <img src={preview} alt="Shop logo preview" /> : <span>No logo</span>}
          </div>
          <div>
            <label htmlFor="s_logo">Shop logo</label>
            <input id="s_logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={pickLogo} />
            {preview && (
              <button
                type="button" className="link"
                onClick={() => { setLogoBlob(null); setRemoveLogo(true); setPreview(null); }}
              >Remove logo</button>
            )}
            <div className="hint">Stored in your Supabase bucket.</div>
          </div>
        </div>
        <div className="full">
          <label htmlFor="s_name">Shop name</label>
          <input id="s_name" type="text" autoComplete="off" placeholder="e.g. Sri Lakshmi Stores" value={f.name} onChange={set("name")} />
        </div>
        <div className="full">
          <label htmlFor="s_phone">Shop phone number</label>
          <input id="s_phone" type="tel" pattern="[0-9+\-\s]{7,15}" placeholder="e.g. 9876543210" value={f.phone} onChange={set("phone")} />
        </div>
        <div className="full">
          <label htmlFor="s_address">Shop address</label>
          <textarea id="s_address" value={f.address} onChange={set("address")} />
        </div>
        <div className="full">
          <label htmlFor="s_slogan">Slogan <span className="muted">(optional)</span></label>
          <input id="s_slogan" type="text" autoComplete="off" value={f.slogan} onChange={set("slogan")} />
        </div>
        <div>
          <label htmlFor="s_email">Email <span className="muted">(optional)</span></label>
          <input id="s_email" type="email" autoComplete="off" value={f.email} onChange={set("email")} />
        </div>
        <div>
          <label htmlFor="s_website">Website <span className="muted">(optional)</span></label>
          <input id="s_website" type="text" autoComplete="off" value={f.website} onChange={set("website")} />
        </div>
        <div className="full">
          <label htmlFor="s_terms">Terms &amp; Conditions <span className="muted">(optional)</span></label>
          <textarea id="s_terms" placeholder={"One per line, e.g.\nGoods once sold will not be taken back."} value={f.terms} onChange={set("terms")} />
          <div className="hint">One per line — printed at the bottom of every invoice.</div>
        </div>
        {error && <div className="error full">{error}</div>}
      </div>
      <div className="dlg-foot">
        <button type="submit" className="primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
