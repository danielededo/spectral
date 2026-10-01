import { normalizeHost, parseMx, parseTxt } from "./detect";

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const RDAP_ENDPOINT = "https://rdap.org/ip/";
const TIMEOUT_MS = 6000;

const TYPE = { A: 1, NS: 2, CNAME: 5, SOA: 6, MX: 15, TXT: 16, AAAA: 28, CAA: 257 } as const;
type RecordType = keyof typeof TYPE;

interface DohRecord {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DohResponse {
  Status: number;
  Answer?: DohRecord[];
  Authority?: DohRecord[];
}

async function doh(name: string, type: RecordType): Promise<DohResponse> {
  const url = `${DOH_ENDPOINT}?name=${encodeURIComponent(name)}&type=${type}`;
  const res = await fetch(url, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`DoH ${type} ${name}: HTTP ${res.status}`);
  return (await res.json()) as DohResponse;
}

const answers = (r: DohResponse, type: RecordType) =>
  (r.Answer ?? []).filter((a) => a.type === TYPE[type]).map((a) => a.data);

export interface HostRecords {
  cnames: string[];
  a: string[];
  aaaa: string[];
}

export async function resolveHost(hostname: string): Promise<HostRecords> {
  const [v4, v6] = await Promise.all([doh(hostname, "A"), doh(hostname, "AAAA")]);
  return {
    cnames: answers(v4, "CNAME").map(normalizeHost),
    a: answers(v4, "A"),
    aaaa: answers(v6, "AAAA"),
  };
}

export async function findZoneApex(hostname: string): Promise<string> {
  const r = await doh(hostname, "SOA");
  const soa = [...(r.Answer ?? []), ...(r.Authority ?? [])].find((rec) => rec.type === TYPE.SOA);
  return soa ? normalizeHost(soa.name) : hostname;
}

export interface ZoneRecords {
  apex: string;
  ns: string[];
  mx: Array<{ priority: number; host: string }>;
  txt: string[];
  caa: string[];
}

export async function resolveZone(hostname: string): Promise<ZoneRecords> {
  const apex = await findZoneApex(hostname);
  const [ns, mx, txt, caa] = await Promise.all([
    doh(apex, "NS"),
    doh(apex, "MX"),
    doh(apex, "TXT"),
    doh(apex, "CAA"),
  ]);
  return {
    apex,
    ns: answers(ns, "NS").map(normalizeHost).sort(),
    mx: answers(mx, "MX")
      .map(parseMx)
      .sort((x, y) => x.priority - y.priority),
    txt: answers(txt, "TXT").map(parseTxt),
    caa: answers(caa, "CAA"),
  };
}

export interface MailPolicyRecords {
  dmarc: string[];
  mtaSts: string[];
  tlsRpt: string[];
}

export async function resolveMailPolicy(apex: string): Promise<MailPolicyRecords> {
  const txt = async (name: string) => answers(await doh(name, "TXT"), "TXT").map(parseTxt);
  const [dmarc, mtaSts, tlsRpt] = await Promise.all([
    txt(`_dmarc.${apex}`),
    txt(`_mta-sts.${apex}`),
    txt(`_smtp._tls.${apex}`),
  ]);
  return { dmarc, mtaSts, tlsRpt };
}

export interface IpNetwork {
  ip: string;
  name: string | null;
  organization: string | null;
  country: string | null;
  range: string | null;
}

interface RdapEntity {
  roles?: string[];
  vcardArray?: [string, Array<[string, unknown, string, unknown]>];
}

interface RdapIp {
  name?: string;
  country?: string;
  startAddress?: string;
  endAddress?: string;
  cidr0_cidrs?: Array<{ v4prefix?: string; v6prefix?: string; length: number }>;
  entities?: RdapEntity[];
}

function entityName(entity: RdapEntity): string | null {
  const fn = entity.vcardArray?.[1].find(([key]) => key === "fn");
  return typeof fn?.[3] === "string" ? fn[3] : null;
}

export function summarizeRdap(ip: string, data: RdapIp): IpNetwork {
  const cidr = data.cidr0_cidrs?.[0];
  const prefix = cidr?.v4prefix ?? cidr?.v6prefix;
  const range = prefix
    ? `${prefix}/${cidr!.length}`
    : data.startAddress && data.endAddress
      ? `${data.startAddress} - ${data.endAddress}`
      : null;
  const registrant = data.entities?.find((e) => e.roles?.includes("registrant")) ?? data.entities?.[0];
  return {
    ip,
    name: data.name ?? null,
    organization: registrant ? entityName(registrant) : null,
    country: data.country ?? null,
    range,
  };
}

export async function lookupIp(ip: string): Promise<IpNetwork> {
  const res = await fetch(RDAP_ENDPOINT + encodeURIComponent(ip), {
    headers: { accept: "application/rdap+json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`RDAP ${ip}: HTTP ${res.status}`);
  return summarizeRdap(ip, (await res.json()) as RdapIp);
}
