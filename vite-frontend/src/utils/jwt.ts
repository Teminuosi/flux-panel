/**
 * JWT工具类 - TypeScript版本
 */

interface JWTPayload {
  sub: string;
  role_id: number;
  user: string;
  exp: number;
  iat: number;
}

/**
 * 从JWT Token中获取payload
 * @param token JWT Token
 * @returns payload数据
 */
function getPayloadFromToken(token: string): JWTPayload | null {
  try {
    if (!token) return null;
    
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // 后端签的是 URL-safe base64(JwtUtil:Base64.getUrlEncoder().withoutPadding()),
    // 用 - 和 _;而 atob 只认标准表的 + 和 /,遇到就抛 InvalidCharacterError。
    // 抛出来被下面 catch 掉返回 null → isTokenValid false → 路由守卫把人弹回登录页,
    // 表现就是「提示登录成功却进不去,反复要求重新输账号密码」。
    //
    // 出不出现 - / _ 取决于 payload 的字节,所以是【某些账号永远登不上、
    // 另一些一直正常】—— 非 ASCII 用户名特别容易中,因为 user 和 name 两个字段
    // 都放了用户名,多字节内容翻倍。实测「三月站长」「站长abc」「测试管理员账号」
    // 100% 登不上,而「三月」「管理员」「admin」正常。
    //
    // 所以先换回标准表、补齐 padding 再解;并且按 UTF-8 解码 ——
    // atob 出来的是按字节的 latin1 串,直接用会把中文用户名变成乱码。
    const std = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = std + '='.repeat((4 - (std.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8').decode(bytes)) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * 从JWT Token中获取用户ID
 * @param token JWT Token
 * @returns 用户ID
 */
export function getUserIdFromToken(token: string): number | null {
  const payload = getPayloadFromToken(token);
  return payload ? parseInt(payload.sub) : null;
}

/**
 * 从JWT Token中获取用户角色ID
 * @param token JWT Token
 * @returns 角色ID
 */
export function getRoleIdFromToken(token: string): number | null {
  const payload = getPayloadFromToken(token);
  return payload ? payload.role_id : null;
}

/**
 * 从JWT Token中获取用户名
 * @param token JWT Token
 * @returns 用户名
 */
export function getUsernameFromToken(token: string): string | null {
  const payload = getPayloadFromToken(token);
  return payload ? payload.user : null;
}

/**
 * 验证token是否过期
 * @param token JWT Token
 * @returns 是否有效
 */
export function isTokenValid(token: string): boolean {
  const payload = getPayloadFromToken(token);
  if (!payload) return false;
  
  const now = Math.floor(Date.now() / 1000);
  return payload.exp > now;
}

// JwtUtil对象，提供便捷的静态方法调用
export const JwtUtil = {
  /**
   * 从localStorage获取token并解析用户ID
   * @returns 用户ID
   */
  getUserIdFromToken(): number | null {
    const token = localStorage.getItem('token');
    return token ? getUserIdFromToken(token) : null;
  },
  
  /**
   * 从localStorage获取token并解析角色ID
   * @returns 角色ID
   */
  getRoleIdFromToken(): number | null {
    const token = localStorage.getItem('token');
    return token ? getRoleIdFromToken(token) : null;
  },
  
  /**
   * 从localStorage获取token并解析用户名
   * @returns 用户名
   */
  getUsernameFromToken(): string | null {
    const token = localStorage.getItem('token');
    return token ? getUsernameFromToken(token) : null;
  },
  
  /**
   * 验证localStorage中的token是否有效
   * @returns 是否有效
   */
  isTokenValid(): boolean {
    const token = localStorage.getItem('token');
    return token ? isTokenValid(token) : false;
  }
}; 