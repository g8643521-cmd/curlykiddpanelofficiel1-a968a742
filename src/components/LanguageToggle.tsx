import { useI18n, Lang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

const LanguageToggle = () => {
  const { lang, setLang } = useI18n();

  const toggle = () => setLang(lang === "en" ? "da" : "en");

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      className="gap-1.5 h-8 text-xs font-medium"
    >
      <Globe className="w-3.5 h-3.5" />
      {lang === "en" ? "DA" : "EN"}
    </Button>
  );
};

export default LanguageToggle;
