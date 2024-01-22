#!/usr/bin/env bash

# Title:        import-data.sh
# Description:  Load data from file to an existing SQL server database table. Specify a directory containing collection of data files to load
# Prequisite:
#       - Installation of bcp, see https://learn.microsoft.com/en-us/sql/tools/bcp-utility and https://learn.microsoft.com/en-us/sql/connect/odbc/linux-mac/install-microsoft-odbc-driver-sql-server-macos?view=sql-server-ver16#microsoft-odbc-18
# Assumptions:
#       - bcp and any dependencies must be installed.
#       - Data file must be in a valid format. Pipe delimiter is prefered but logic available to convert comma delimters (that are not between quotes) into pipe characters.
# Other Notes:
#       - For future refactoring or managing csv, the following might be of interest: https://csvkit.readthedocs.io/en/latest/index.html
#       - Create a file named 'secret' containing the password to be used to connect to the sql server
#
# Usage:         ops/scripts/utility/az-sql-import-data.sh -d <data directory> -S <server> -D <database name> -u <user>
#
# Exitcodes
# ==========
# 0     No error
# 2     Unknown flag/switch
# +10   Validation check errors
#
set -euo pipefail # ensure job step fails in CI pipeline when error occurs

bcp -v # check that utility is installed

delimiter="," # default delimiter is a comma but prefer pipes
ext=".csv"
dirpath="."
while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        echo 'USAGE: ops/scripts/utility/az-sql-import-data.sh -d <data directory> -S <server> -D <database name> -u <user>'
        exit 0
        ;;

    --delimiter)
        delimiter="${2}"
        shift 2
        ;;

    --ext) # expected data file extension
        ext="${2}"
        shift 2
        ;;

    -d | --dirpath) # path to the directory containing the data files to load
        dirpath="${2}"
        shift 2
        ;;

    -S | --server)
        server="${2}"
        shift 2
        ;;

    -D | --database)
        database="${2}"
        shift 2
        ;;

    -u | --user)
        user="${2}"
        shift 2
        ;;

    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

if [[ -z "${server}" ]]; then
    echo "Error: Missing server"
    exit 11
fi
if [[ -z "${database}" ]]; then
    echo "Error: Missing database"
    exit 12
fi
if [[ -z "${user}" ]]; then
    echo "Error: Missing user"
    exit 13
fi

function import_data_from_file_func() {
    local targetDataFilepath=$1
    local targetTable=$2

    if [[ -z "${targetDataFilepath}" ]]; then
        echo "Error: Missing file path to data"
        exit 21
    fi
    if [[ -z "${targetTable}" ]]; then
        echo "Error: Missing database table name ${targetDataFilepath}"
        exit 22
    fi

    local currentDataFile=${targetDataFilepath} # stores the path to the modified data file used to import the data

    echo "Starting data import for ${targetDataFilepath} into table ${targetTable}"

    # Check and handle non pipeline delimited files
    if [[ "${delimiter}" == "|" ]]; then
        echo "Handle data file at ${filepath} as a pipe delimited file."
    elif [[ "${delimiter}" == "," ]]; then
        echo "Convert delimiter [${delimiter}] to pipes"
        sed -Ee :1 -e 's/^(([^",]|"[^"]*")*),/\1|/;t1' <./"${filepath}" 1>"${filepath}"-tmp-1
        currentDataFile=${filepath}-tmp-1
    else
        echo "Error: Unsupported delimiter [${delimiter}]"
        exit 12
    fi

    # Clean up possible quotes right after/before pipe delimiter
    sed -Ee :1 -e 's/(\|{1}"{1})|("{1}\|{1})/|/;t1' <./"${currentDataFile}" 1>"${filepath}"-tmp-2
    currentDataFile=${filepath}-tmp-2

    # Remove NULL string between delimiters. If NULL exists in the data file, bcp throws a right truncated error on the column
    sed -Ee :1 -e 's/\|NULL/|/;t1' <./"${currentDataFile}" 1>"${filepath}"-tmp-3
    currentDataFile=${filepath}-tmp-3

    #shellcheck disable=SC2155
    local p=$(cat ./secret) # NOTE: SQL pw read from local file

    echo "Executing bcp command"
    # bcp ${targetTable} in ${currentDataFile} \
    #     -S ${server} -d ${database} -U ${user} \      # Database connection parameters. Password will be prompted
    #     -e err-${database}-${targetTable}.out \             # Output file with detail of errors
    #     -c \                                          # Perform bcp operation using a character type. See docs for more details.
    #     -t "|" \                                      # Choose a pipe (|) as the delimiter
    #     -r "0x0D0A"                                     # Specify row terminator in hexadecimall format CR (0x0D) LF (0x0a)
    bcp "${targetTable}" in "${currentDataFile}" -S "${server}" -d "${database}" -U "${user}" -e err-"${database}"-"${targetTable}".out -c -t "|" -r "0x0D0A" -P "${p}"
    echo "Completed exported command execution"

    echo "Cleaning up temporary files"
    rm ./"${filepath}"-tmp-*
}

# shellcheck disable=SC2231
for filepath in ${dirpath}/*${ext}; do # NOTE: expects a hard code file extension csv
    table=$(echo "${filepath}" | sed "s/${ext}//" | sed "s/${dirpath}\///" | tr '[:lower:]' '[:upper:]')

    import_data_from_file_func "${filepath}" "${table}"
done

echo "DONE"
