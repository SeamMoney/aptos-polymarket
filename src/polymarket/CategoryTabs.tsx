import type { Category } from "./types";

// Breaking icon - trend line with circle
function BreakingIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0 mr-1.5">
      <path d="M16.5099 5.41065L11.4375 10.7299C11.2425 10.9249 10.9255 10.9249 10.7305 10.7299L7.27047 7.26992C7.07547 7.07492 6.75847 7.07492 6.56347 7.26992L2.23047 11.5989M16.5099 5.41065H12.4449M16.5099 5.41065V9.48355" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.5787 12.0517C14.4269 14.5312 11.9143 16.25 9 16.25C4.996 16.25 1.75 13.004 1.75 9C1.75 4.996 4.996 1.75 9 1.75C10.279 1.75 11.4804 2.08107 12.5234 2.66215" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface CategoryTabsProps {
  categories: Category[];
  selectedCategory: Category;
  onSelectCategory: (category: Category) => void;
}

export function CategoryTabs({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryTabsProps) {
  const getLabel = (category: Category) => {
    if (category === "All") return "Breaking";
    return category;
  };

  return (
    <div className="flex overflow-x-auto px-4 py-3 gap-6">
      {categories.map((category) => {
        const isSelected = selectedCategory === category;
        const showIcon = category === "All"; // Only show breaking icon for "Breaking" tab

        return (
          <button
            key={category}
            onClick={() => onSelectCategory(category)}
            className="flex items-center shrink-0"
          >
            {showIcon && (
              <BreakingIcon color={isSelected ? "#ffffff" : "#6E7681"} />
            )}
            <span
              className={`text-base ${
                isSelected
                  ? "text-white font-semibold"
                  : "text-poly-textMuted"
              }`}
            >
              {getLabel(category)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
