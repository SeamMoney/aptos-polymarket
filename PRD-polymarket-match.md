# PRD: Match Polymarket UI Exactly

## Objective
Iterate until our Khamenei market page UI matches Polymarket's official UI pixel-perfect.

## Reference
- Polymarket URL: https://polymarket.com/event/khamenei-out-as-supreme-leader-of-iran-by-march-31
- Screenshots saved in: `.playwright-mcp/polymarket-khamenei-*.png`

## Tasks

### Task 1: Date Selector Pills
- [x] Style to match Polymarket exactly
- [x] "Past" with dropdown chevron
- [x] Selected pill: white background, dark text
- [x] Unselected pills: dark gray background with border (#2f3f50), light gray text
- [x] Pill shape with border-radius: 9999px
- [x] Horizontal scrollable on mobile

### Task 2: Buy Yes/No Buttons
- [x] Add sticky Buy Yes/No buttons at bottom
- [x] Full-width solid colored buttons (green/red)
- [x] Green: #43c773 for Buy Yes
- [x] Red: #e13737 for Buy No
- [x] Display current price in cents (e.g., "Buy Yes 32¢")

### Task 3: Chart Styling
- [x] Make line graph thinner (1.8px instead of 2.5px)
- [x] Move Polymarket watermark to top-left
- [x] Make watermark larger and more visible (opacity 0.25)
- [x] X-axis labels: "Dec 28" and "Jan 11" for MAX timeframe

### Task 4: Market Image
- [x] Use correct Khamenei image from Polymarket S3
- [x] Image shows Khamenei raising hand in clerical robe

### Task 5: Typography & Spacing (Verify)
- [ ] Title font: 20px, weight 600, line-height 25px
- [ ] Volume text: 13px, weight 500
- [ ] Time tabs: 13px, weight 500, padding 4px 6px
- [ ] "% chance" text styling matches Polymarket

### Task 6: Comparison Loop
1. Run app at localhost:5173
2. Navigate to Khamenei market
3. Take screenshot with Playwright
4. Compare side-by-side with Polymarket screenshot
5. Identify differences
6. Fix differences
7. Repeat until pixel-perfect

## Verification Script

```bash
# Start dev server
npm run dev &

# Wait for server
sleep 5

# Take screenshot of our app
npx playwright screenshot http://localhost:5173/market/iran-khamenei --full-page -o screenshots/our-khamenei.png

# Compare visually or programmatically
```

## Success Criteria
- Date selector pills look identical to Polymarket
- Buy Yes/No buttons present and styled correctly
- Chart line thickness matches
- Watermark positioned top-left
- Correct Khamenei profile picture displayed
- All typography matches (font size, weight, spacing)
