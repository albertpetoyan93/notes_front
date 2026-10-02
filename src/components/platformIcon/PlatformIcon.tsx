import type { IconType } from "react-icons";
import { FaMicrosoft } from "react-icons/fa";
import {
  SiAdobe,
  SiAirbnb,
  SiAmazon,
  SiAmazonwebservices,
  SiApple,
  SiAtlassian,
  SiBinance,
  SiBitbucket,
  SiCanva,
  SiCloudflare,
  SiCoinbase,
  SiDigitalocean,
  SiDiscord,
  SiDocker,
  SiDropbox,
  SiFacebook,
  SiFigma,
  SiFirebase,
  SiGithub,
  SiGitlab,
  SiGmail,
  SiGoogle,
  SiGooglechrome,
  SiGoogledrive,
  SiHeroku,
  SiInstagram,
  SiJira,
  SiLastpass,
  SiLinkedin,
  SiMessenger,
  SiMeta,
  SiMongodb,
  SiMysql,
  SiNetflix,
  SiNetlify,
  SiNotion,
  SiNpm,
  SiOpenai,
  SiPaypal,
  SiPinterest,
  SiPostgresql,
  SiProton,
  SiReddit,
  SiRedis,
  SiShopify,
  SiSlack,
  SiSnapchat,
  SiSpotify,
  SiSteam,
  SiStripe,
  SiSupabase,
  SiTelegram,
  SiThreads,
  SiTiktok,
  SiTrello,
  SiTwitch,
  SiUber,
  SiVercel,
  SiWhatsapp,
  SiWordpress,
  SiX,
  SiYoutube,
  SiZoom,
} from "react-icons/si";
import "./platformIcon.scss";

type Brand = {
  icon: IconType;
  color: string;
  bg?: string;
  label: string;
};

const brand = (
  icon: IconType,
  color: string,
  label: string,
  keys: string[],
  bg?: string
): [string, Brand][] => keys.map((key) => [key, { icon, color, label, bg }]);

const BRANDS = new Map<string, Brand>([
  ...brand(SiFacebook, "#0866FF", "Facebook", ["facebook", "facebook.com", "fb", "fb.com"]),
  ...brand(SiInstagram, "#E4405F", "Instagram", ["instagram", "instagram.com"]),
  ...brand(SiWhatsapp, "#25D366", "WhatsApp", ["whatsapp", "whatsapp.com", "wa.me"]),
  ...brand(SiMessenger, "#00B2FF", "Messenger", ["messenger", "messenger.com"]),
  ...brand(SiMeta, "#0668E1", "Meta", ["meta", "meta.com"]),
  ...brand(SiThreads, "#000000", "Threads", ["threads", "threads.net"]),
  ...brand(SiGoogle, "#4285F4", "Google", ["google", "google.com"]),
  ...brand(SiGmail, "#EA4335", "Gmail", ["gmail", "gmail.com", "mail.google.com"]),
  ...brand(SiYoutube, "#FF0000", "YouTube", ["youtube", "youtube.com", "youtu.be"]),
  ...brand(SiGoogledrive, "#4285F4", "Google Drive", [
    "googledrive",
    "google drive",
    "drive.google.com",
  ]),
  ...brand(SiGooglechrome, "#4285F4", "Chrome", ["chrome", "google chrome", "googlechrome"]),
  ...brand(FaMicrosoft, "#00A4EF", "Microsoft", [
    "microsoft",
    "microsoft.com",
    "live.com",
    "hotmail.com",
    "outlook",
    "outlook.com",
    "office.com",
    "office365",
    "office365.com",
    "microsoftonline.com",
  ]),
  ...brand(SiGithub, "#181717", "GitHub", ["github", "github.com"]),
  ...brand(SiGitlab, "#FC6D26", "GitLab", ["gitlab", "gitlab.com"]),
  ...brand(SiBitbucket, "#0052CC", "Bitbucket", ["bitbucket", "bitbucket.org"]),
  ...brand(SiApple, "#000000", "Apple", ["apple", "apple.com", "icloud", "icloud.com"]),
  ...brand(SiAmazon, "#FF9900", "Amazon", ["amazon", "amazon.com"]),
  ...brand(SiAmazonwebservices, "#FF9900", "AWS", [
    "aws",
    "aws.amazon.com",
    "amazon web services",
  ]),
  ...brand(SiNetflix, "#E50914", "Netflix", ["netflix", "netflix.com"]),
  ...brand(SiSpotify, "#1DB954", "Spotify", ["spotify", "spotify.com"]),
  ...brand(SiSlack, "#4A154B", "Slack", ["slack", "slack.com"]),
  ...brand(SiDiscord, "#5865F2", "Discord", ["discord", "discord.com", "discord.gg"]),
  ...brand(SiLinkedin, "#0A66C2", "LinkedIn", ["linkedin", "linkedin.com"]),
  ...brand(SiX, "#000000", "X", ["x", "x.com", "twitter", "twitter.com"]),
  ...brand(SiReddit, "#FF4500", "Reddit", ["reddit", "reddit.com"]),
  ...brand(SiTiktok, "#000000", "TikTok", ["tiktok", "tiktok.com"]),
  ...brand(SiSnapchat, "#000000", "Snapchat", ["snapchat", "snapchat.com"], "#FFFC00"),
  ...brand(SiPinterest, "#BD081C", "Pinterest", ["pinterest", "pinterest.com"]),
  ...brand(SiTelegram, "#26A5E4", "Telegram", ["telegram", "telegram.org", "t.me"]),
  ...brand(SiTwitch, "#9146FF", "Twitch", ["twitch", "twitch.tv"]),
  ...brand(SiSteam, "#000000", "Steam", ["steam", "steampowered.com", "steamcommunity.com"]),
  ...brand(SiDropbox, "#0061FF", "Dropbox", ["dropbox", "dropbox.com"]),
  ...brand(SiNotion, "#000000", "Notion", ["notion", "notion.so"]),
  ...brand(SiFigma, "#F24E1E", "Figma", ["figma", "figma.com"]),
  ...brand(SiZoom, "#0B5CFF", "Zoom", ["zoom", "zoom.us"]),
  ...brand(SiCanva, "#00C4CC", "Canva", ["canva", "canva.com"]),
  ...brand(SiAdobe, "#FF0000", "Adobe", ["adobe", "adobe.com"]),
  ...brand(SiPaypal, "#003087", "PayPal", ["paypal", "paypal.com"]),
  ...brand(SiStripe, "#635BFF", "Stripe", ["stripe", "stripe.com"]),
  ...brand(SiShopify, "#7AB55C", "Shopify", ["shopify", "shopify.com"]),
  ...brand(SiWordpress, "#21759B", "WordPress", ["wordpress", "wordpress.com", "wordpress.org"]),
  ...brand(SiCloudflare, "#F38020", "Cloudflare", ["cloudflare", "cloudflare.com"]),
  ...brand(SiDigitalocean, "#0080FF", "DigitalOcean", ["digitalocean", "digitalocean.com"]),
  ...brand(SiDocker, "#2496ED", "Docker", ["docker", "docker.com"]),
  ...brand(SiNetlify, "#00C7B7", "Netlify", ["netlify", "netlify.com", "netlify.app"]),
  ...brand(SiVercel, "#000000", "Vercel", ["vercel", "vercel.com"]),
  ...brand(SiHeroku, "#430098", "Heroku", ["heroku", "herokuapp.com"]),
  ...brand(SiNpm, "#CB3837", "npm", ["npm", "npmjs.com"]),
  ...brand(SiOpenai, "#000000", "OpenAI", ["openai", "openai.com", "chatgpt", "chat.openai.com"]),
  ...brand(SiBinance, "#F0B90B", "Binance", ["binance", "binance.com"]),
  ...brand(SiCoinbase, "#0052FF", "Coinbase", ["coinbase", "coinbase.com"]),
  ...brand(SiProton, "#6D4AFF", "Proton", ["proton", "proton.me", "protonmail", "protonmail.com"]),
  ...brand(SiLastpass, "#D32D27", "LastPass", ["lastpass", "lastpass.com"]),
  ...brand(SiMongodb, "#47A248", "MongoDB", ["mongodb", "mongodb.com"]),
  ...brand(SiPostgresql, "#4169E1", "PostgreSQL", ["postgresql", "postgres", "postgresql.org"]),
  ...brand(SiMysql, "#4479A1", "MySQL", ["mysql", "mysql.com"]),
  ...brand(SiRedis, "#FF4438", "Redis", ["redis", "redis.io"]),
  ...brand(SiSupabase, "#3FCF8E", "Supabase", ["supabase", "supabase.com", "supabase.co"]),
  ...brand(SiFirebase, "#DD2C00", "Firebase", ["firebase", "firebase.google.com"]),
  ...brand(SiAtlassian, "#0052CC", "Atlassian", ["atlassian", "atlassian.com", "atlassian.net"]),
  ...brand(SiJira, "#0052CC", "Jira", ["jira", "jira.com"]),
  ...brand(SiTrello, "#0052CC", "Trello", ["trello", "trello.com"]),
  ...brand(SiUber, "#000000", "Uber", ["uber", "uber.com"]),
  ...brand(SiAirbnb, "#FF5A5F", "Airbnb", ["airbnb", "airbnb.com"]),
]);

const CREDENTIAL_CATEGORIES = new Set([
  "password",
  "login",
  "ssh",
  "db",
  "address",
  "card",
]);
const SKIP_WORDS = new Set(["my", "the", "app", "login", "account", "work", "personal", "new", "old", "test"]);
const MULTI_TLDS = new Set(["co.uk", "com.au", "co.jp", "com.br", "co.nz", "com.tr", "co.za"]);

type NoteLike = {
  title?: string;
  category?: string;
  content?: unknown;
};

const customFields = (content: unknown) => {
  if (typeof content === "object" && content !== null && "customFields" in content) {
    const fields = (content as { customFields?: { label?: string; value?: string }[] }).customFields;
    return Array.isArray(fields) ? fields : [];
  }
  return [];
};

const fieldValue = (fields: { label?: string; value?: string }[], pattern: RegExp) => {
  const match = fields.find((field) => pattern.test(String(field.label || "")));
  return String(match?.value || "").trim();
};

const lookupKeys = (raw: string) => {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return [];
  const keys: string[] = [];
  const add = (value: string) => {
    const key = value.trim().toLowerCase();
    if (key && !keys.includes(key)) keys.push(key);
  };

  let host = trimmed.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  if (host.includes("@")) host = host.split("@").pop() || host;
  host = host.split(":")[0];

  if (host.includes(".")) {
    add(host);
    const parts = host.split(".").filter(Boolean);
    const tail2 = parts.slice(-2).join(".");
    const tail3 = parts.slice(-3).join(".");
    if (MULTI_TLDS.has(tail2) && parts.length >= 3) add(tail3);
    else if (parts.length >= 2) add(tail2);
  }

  const words = trimmed.replace(/[^a-z0-9]+/g, " ").trim();
  add(words);
  add(words.replace(/ /g, ""));
  const first = words.split(" ")[0];
  if (first && first.length > 2 && !SKIP_WORDS.has(first)) add(first);
  return keys;
};

const matchBrand = (sources: string[]) => {
  for (const source of sources) {
    for (const key of lookupKeys(source)) {
      const found = BRANDS.get(key);
      if (found) return found;
    }
  }
  return null;
};

export const resolvePlatform = (note: NoteLike) => {
  const fields = customFields(note.content);
  const platform = fieldValue(fields, /platform|service|^brand$/i);
  const url = fieldValue(fields, /^(url|uri|website|connect)$/i);
  const host = fieldValue(fields, /^host$/i);
  const credential = CREDENTIAL_CATEGORIES.has(note.category || "");
  const sources = [url, platform, host];
  if (credential && note.title) sources.push(note.title);

  const found = matchBrand(sources);
  const letterSource = platform || host || note.title || "";
  const letter = letterSource.replace(/[^a-z0-9]/gi, "").charAt(0).toUpperCase();

  if (found) return { ...found, letter };
  if (!credential || !letter) return null;
  return { icon: null, color: "", bg: "", label: letterSource, letter };
};

const PlatformIcon = ({ note, size = 22 }: { note: NoteLike; size?: number }) => {
  const brandIcon = resolvePlatform(note);
  if (!brandIcon) return null;
  const Icon = brandIcon.icon;
  return (
    <span
      className={`platform-icon${Icon ? "" : " is-letter"}`}
      style={{ width: size, height: size, color: brandIcon.color || undefined, background: brandIcon.bg || undefined }}
      title={brandIcon.label}
      aria-hidden
    >
      {Icon ? <Icon /> : brandIcon.letter}
    </span>
  );
};

export default PlatformIcon;
