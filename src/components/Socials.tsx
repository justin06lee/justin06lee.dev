// Site-wide social bar. Now backed by the chrome registry's socials
// (`@/components/chrome/socials`) — same platform order, sizes, email-copy
// behavior, and tooltip look. The default export keeps the historical
// `SocialBar` name; the SocialKey / SocialLinks types are re-exported too.
import { Socials, type SocialsProps } from "@/components/chrome/socials";

export { type SocialKey, type SocialLinks } from "@/components/chrome/socials";
export type SocialBarProps = SocialsProps;

export default Socials;
