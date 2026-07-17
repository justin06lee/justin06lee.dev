// Site-wide dialog provider. Now backed by the chrome registry's dialog
// (`@/components/chrome/dialog`), which is the enhanced port of this component
// (adds a focus trap, focus restore, and danger-aware default focus). The API
// — <DialogProvider> + useDialog().confirm/alert — is unchanged, so every
// existing consumer keeps working.
export { DialogProvider, useDialog } from "@/components/chrome/dialog";
