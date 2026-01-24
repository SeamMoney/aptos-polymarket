import type { Category } from "./types";

// Trending icon - simple upward trend line (Polymarket style)
function TrendingIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 mr-1.5">
      <path
        d="M3 17L9 11L13 15L21 7M21 7H15M21 7V13"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
    if (category === "All") return "Trending";
    return category;
  };

  return (
    <div className="relative border-b border-[#2c3f4f] pt-2 pb-2">
      {/* Scrollable tabs container */}
      <div
        className="flex overflow-x-auto px-4 h-[36px] items-center"
        style={{
          gap: '2px',
          scrollbarWidth: 'none',  /* Firefox */
          msOverflowStyle: 'none', /* IE/Edge */
        }}
      >
        {categories.map((category) => {
          const isSelected = selectedCategory === category;
          const showIcon = category === "All"; // Show trending icon for first tab

          return (
            <button
              key={category}
              onClick={() => onSelectCategory(category)}
              className="flex items-center shrink-0 whitespace-nowrap"
              style={{
                fontSize: '16px',
                fontWeight: 400,
                fontFamily: '"Open Sauce One", sans-serif',
                color: isSelected ? '#f2f2f2' : 'rgb(137, 156, 178)',
                padding: '4px 8px',
              }}
            >
              {showIcon && (
                <TrendingIcon color={isSelected ? "#f2f2f2" : "rgb(137, 156, 178)"} />
              )}
              {getLabel(category)}
            </button>
          );
        })}
      </div>

      {/* Right fade gradient overlay */}
      <div
        className="absolute right-0 top-0 bottom-0 w-24 pointer-events-none"
        style={{
          background: 'linear-gradient(to right, transparent 0%, #1c2b3a 70%)',
        }}
      />
    </div>
  );
}
