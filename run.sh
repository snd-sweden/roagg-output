#!/bin/bash

# Clone the research-output-aggregator repository if not present
if [ ! -d "research-output-aggregator" ]; then
    echo "Directory research-output-aggregator not found, cloning repository..."
    git clone https://github.com/snd-sweden/research-output-aggregator
else
    echo "Directory research-output-aggregator exists, pulling latest changes..."
    cd research-output-aggregator && git pull && pip install -e . && cd ..
fi


DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TSV="$DIR/resources/organisations.tsv"

while IFS=$'\t' read -r -a cols || [ -n "${cols[*]}" ]; do
    [[ ${#cols[@]} -eq 0 ]] && continue

    org_slug="${cols[0]}"
    org_name_en="${cols[1]}"
    org_name_sv="${cols[2]}"
    org_ror="${cols[3]}"

    if [ -f "research-output-aggregator/tests/name-lists/$org_slug.txt" ]; then
        name_txt="research-output-aggregator/tests/name-lists/$org_slug.txt"
        echo "Processing ror+txt $org_slug $org_name_en ror: $org_ror"
        roagg --ror "$org_ror" --name-txt "$name_txt" --output "outputs/$org_slug.csv"

    else
        echo "Processing ror $org_slug $org_name_en ror: $org_ror"
        roagg --ror "$org_ror" --output "outputs/$org_slug.csv"
    fi
done < "$TSV"

echo "Add clientName and clientType to all files"
python3 ./scripts/add_datacite_clients_info.py

echo "Combine all outputs into combined-outputs.csv"
sh ./combine_outputs.sh

echo "All done!"