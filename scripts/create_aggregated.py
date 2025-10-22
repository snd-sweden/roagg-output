#!/usr/bin/env python3
import csv
import glob

def outputs_pattern():
    return "outputs/*.csv"

def get_orgs():
    orgs = []
    for csv_file in glob.glob(outputs_pattern()):
        basename = csv_file.split("/")[-1].replace(".csv", "")
        orgs.append(basename)
    return orgs

if __name__ == "__main__":
    combined_output = dict()
    orgs = get_orgs()
    for csv_file in glob.glob("outputs/*.csv"):
        print(f"Processing {csv_file}")
        basename = csv_file.split("/")[-1].replace(".csv", "")

        with open(csv_file, "r") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        for row in rows:
            row.pop("isPublisher", None)
            row.pop("haveCreatorAffiliation", None)
            row.pop("haveContributorAffiliation", None)

            if combined_output.get(row["doi"].lower()):
                combined_output[row["doi"].lower()]["uniqueSwedishOrgCount"] = str(int(combined_output[row["doi"].lower()]["uniqueSwedishOrgCount"]) + 1)
                combined_output[row["doi"].lower()][f"org_{basename}"] = "1"
            else:
                combined_output[row["doi"].lower()] = row
                #add org column for each org
                for org in orgs:
                    combined_output[row["doi"].lower()][f"org_{org}"] = ""
                combined_output[row["doi"].lower()][f"org_{basename}"] = "1"
                combined_output[row["doi"].lower()]["uniqueSwedishOrgCount"] = "1"

    with open("aggregated-outputs.csv", "w", newline="") as f:
        fieldnames = list(combined_output.values())[0].keys()
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(combined_output.values())
    print(f"Aggregated output written to aggregated-outputs.csv")