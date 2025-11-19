#!/bin/bash

# Clone the roagg repository if not present
if [ ! -d "roagg" ]; then
    echo "Directory roagg not found, cloning repository..."
    git clone https://github.com/snd-sweden/roagg roagg
else
    echo "Directory roagg exists, pulling latest changes..."
    cd roagg && git pull && pip install . && cd ..
fi


DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TSV="$DIR/resources/organisations.tsv"

while IFS=$'\t' read -r -a cols || [ -n "${cols[*]}" ]; do
    [[ ${#cols[@]} -eq 0 ]] && continue

    #skip header line
    if [ "${cols[0]}" == "slug" ]; then
        continue
    fi

    org_slug="${cols[0]}"
    org_name_en="${cols[1]}"
    org_ror="${cols[3]}"
    name_txt="roagg/tests/name-lists/$org_slug.txt"
    output_file="outputs/$org_slug.csv"

    if [ -f "$name_txt" ]; then
        echo "Processing ROR+TXT for $org_slug ($org_name_en) ROR: $org_ror"
        roagg --ror "$org_ror" --name-txt "$name_txt" --output "$output_file"
    else
        echo "Processing ROR for $org_slug ($org_name_en) ROR: $org_ror"
        roagg --ror "$org_ror" --output "$output_file"
    fi
    
    echo "Sleeping for 5 minutes to avoid rate limiting..."
    sleep 300
done < "$TSV"

echo "Add clientName and clientType to all files"
python3 ./scripts/add_datacite_clients_info.py

echo "Combine all outputs into combined-outputs.csv"
sh ./combine_outputs.sh

echo "All done!"