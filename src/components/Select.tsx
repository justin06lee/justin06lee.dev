// Site-wide select. Now backed by the chrome registry's select
// (`@/components/chrome/select`), the enhanced port of this component (full
// keyboard nav: Arrow/Home/End/Enter, aria-activedescendant, focus restore).
// Same default export and SelectOption<T> type, so consumers are untouched.
export { default, type SelectOption } from "@/components/chrome/select";
