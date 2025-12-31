import { TrendingUp } from "lucide-react";
import type { Category } from "./types";

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
    if (category === "All") return "Trending";
    return category;
  };

  return (
    <div className="flex overflow-x-auto px-4 py-3 gap-6">
      {categories.map((category) => {
        const isSelected = selectedCategory === category;
        const showIcon = category === "All"; // Only show trending icon for "Trending" tab

        return (
          <button
            key={category}
            onClick={() => onSelectCategory(category)}
            className="flex items-center shrink-0"
          >
            {showIcon && (
              <TrendingUp
                size={18}
                color={isSelected ? "#ffffff" : "#6E7681"}
                strokeWidth={2.5}
                className="mr-1.5"
              />
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
