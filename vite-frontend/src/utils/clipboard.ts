/**
 * 兼容 http(非安全上下文)的复制。
 *
 * navigator.clipboard 只在 https / localhost(安全上下文)下可用;当面板通过
 * http://IP:端口 访问时,navigator.clipboard 为 undefined,直接调用会抛异常导致
 * “复制失败”。此时回退到老式 document.execCommand('copy') 方案,http 下也能复制。
 *
 * @returns 是否复制成功
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 安全上下文下仍可能因权限失败,落到下面的回退方案
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    // 放在视口内、极小、透明:opacity:0 / 屏外(-9999px)在部分浏览器会让 execCommand copy 失败,
    // 放在视口左上角一个 2em 的透明框更可靠。
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "2em";
    ta.style.height = "2em";
    ta.style.padding = "0";
    ta.style.border = "none";
    ta.style.outline = "none";
    ta.style.boxShadow = "none";
    ta.style.background = "transparent";
    ta.style.color = "transparent";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
