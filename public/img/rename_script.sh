#!/bin/bash

echo "Starting image renaming process..."

# Get PNG files in correct order (goal numbers)
PNG_FILES=($(ls png/ | sort -V))

# Get thumbs files in sequential order  
THUMBS_FILES=($(ls thumbs/ | sort))

# Get highres files in sequential order
HIGHRES_FILES=($(ls highres/ | sort))

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
        
        echo "  $old_thumbs -> $new_thumbs"
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
        
        echo "  $old_highres -> $new_highres"
        cp "highres/$old_highres" "highres_new/$new_highres"
    fi
done

echo "Renaming complete! Check thumbs_new/ and highres_new/ directories."
