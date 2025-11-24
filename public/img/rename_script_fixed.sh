#!/bin/bash

echo "Starting image renaming process..."

# Use arrays with proper quoting for filenames with spaces
mapfile -t PNG_FILES < <(ls png/ | sort -V)
mapfile -t THUMBS_FILES < <(ls thumbs/ | sort)
mapfile -t HIGHRES_FILES < <(ls highres/ | sort)

echo "Files counts: PNG=${#PNG_FILES[@]}, THUMBS=${#THUMBS_FILES[@]}, HIGHRES=${#HIGHRES_FILES[@]}"

# Create temp directories for new names
mkdir -p thumbs_new highres_new

echo "Renaming thumbs files..."
for i in "${!PNG_FILES[@]}"; do
    if [ $i -lt ${#THUMBS_FILES[@]} ]; then
        # Extract goal number from PNG filename (remove .png)
        goal_num="${PNG_FILES[$i]%.png}"
        old_thumbs="${THUMBS_FILES[$i]}"
        new_thumbs="${goal_num}-thumb.jpg"
        
        echo "  $i: $goal_num-thumb.jpg"
        cp "thumbs/$old_thumbs" "thumbs_new/$new_thumbs"
    fi
done

echo "Renaming highres files..."
for i in "${!PNG_FILES[@]}"; do
    if [ $i -lt ${#HIGHRES_FILES[@]} ]; then
        # Extract goal number from PNG filename (remove .png)
        goal_num="${PNG_FILES[$i]%.png}"
        old_highres="${HIGHRES_FILES[$i]}"
        new_highres="${goal_num}.jpg"
        
        echo "  $i: $goal_num.jpg"
        cp "highres/$old_highres" "highres_new/$new_highres"
    fi
done

echo "Renaming complete! Check thumbs_new/ and highres_new/ directories."
echo "First few files in thumbs_new:"
ls thumbs_new/ | head -5
echo "First few files in highres_new:"
ls highres_new/ | head -5
