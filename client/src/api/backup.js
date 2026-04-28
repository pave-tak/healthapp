// 백업/복원 — 플랫폼별 채널 추상화
//
// 웹 브라우저: Blob URL + <a download> 로 다운로드. <input type="file"> 로 가져오기.
// Capacitor(안드로이드 WebView): <a download> 가 동작하지 않으므로
//   Filesystem 으로 디렉터리에 파일을 쓴 뒤 Share 로 사용자에게
//   배포처(드라이브/메일/저장 등)를 직접 선택하게 한다.
//
// Android 11+ 의 scoped storage 정책상 Documents 쓰기는 권한 없이는 실패하기 쉬워서
// External(앱 전용 외부 저장소) → Cache 순으로 폴백한다.

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

const isNative = () => {
  try {
    return Capacitor.isNativePlatform?.() === true;
  } catch {
    return false;
  }
};

function buildFilename() {
  const ts = new Date()
    .toISOString()
    .replace(/[:-]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  return `workout-backup-${ts}.json`;
}

// 디렉터리 후보를 순서대로 시도해 첫 성공한 결과를 반환.
// 어떤 디렉터리에서도 실패하면 마지막 에러를 throw.
async function writeWithFallback(filename, json) {
  const candidates = [
    { dir: Directory.External, label: "External" },   // /Android/data/<pkg>/files (권한 불필요, 가장 안정)
    { dir: Directory.Documents, label: "Documents" }, // /sdcard/Documents (권한 필요할 수 있음)
    { dir: Directory.Cache, label: "Cache" },         // 앱 캐시 (항상 쓰기 가능, 단 OS 가 정리할 수 있음)
  ];
  let lastErr = null;
  for (const c of candidates) {
    try {
      const res = await Filesystem.writeFile({
        path: filename,
        data: json,
        directory: c.dir,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      return { ...res, directory: c.dir, dirLabel: c.label };
    } catch (err) {
      lastErr = err;
      // 다음 후보 시도
    }
  }
  throw lastErr || new Error("백업 파일을 어떤 디렉터리에도 쓸 수 없습니다.");
}

// 결과: { mode: "web-download" | "native-share" | "native-saved", path?, message? }
export async function exportToFile(data) {
  const json = JSON.stringify(data, null, 2);
  const filename = buildFilename();

  if (isNative()) {
    const writeRes = await writeWithFallback(filename, json);
    const fileUri = writeRes?.uri;

    // Share 시도 — 사용자가 즉시 메일/드라이브/파일로 보낼 수 있게
    try {
      const canShare = await Share.canShare();
      if (canShare?.value && fileUri) {
        await Share.share({
          title: "운동 기록 백업",
          text: filename,
          url: fileUri,
          dialogTitle: "백업 파일 보내기 / 저장",
        });
        return {
          mode: "native-share",
          path: fileUri,
          dirLabel: writeRes.dirLabel,
          filename,
        };
      }
    } catch (err) {
      // 공유 취소(사용자 취소)는 정상. 다른 에러도 파일은 이미 저장됐으므로 saved 로 처리.
      // err.message 는 "Share canceled" 같은 텍스트일 수 있다 — 사용자에게 다시 알리지 않는다.
    }
    return {
      mode: "native-saved",
      path: fileUri || `${writeRes.dirLabel}/${filename}`,
      dirLabel: writeRes.dirLabel,
      filename,
    };
  }

  // 웹 브라우저 경로
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { mode: "web-download", filename };
}

// 텍스트로 받은 백업 JSON 을 파싱한다. 파싱 실패 시 throw.
export function parseBackup(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("빈 파일이거나 텍스트를 읽지 못했습니다.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("JSON 파일이 아닙니다.");
  }
}
