#!/usr/bin/env bash

# Title:        import-data.sh
# Description:  Load data from file to an existing SQL server database table.
# Prequisite:
#       - Installation of bcp, see https://learn.microsoft.com/en-us/sql/tools/bcp-utility and https://learn.microsoft.com/en-us/sql/connect/odbc/linux-mac/install-microsoft-odbc-driver-sql-server-macos?view=sql-server-ver16#microsoft-odbc-18
# Assumptions:
#       - bcp and any dependencies must be installed.
#       - Data file must be in a valid format. Pipe delimiter is prefered but logic available to convert comma delimters (that are not between quotes) into pipe characters.
# Other Notes:
#       - For future refactoring or managing csv, the following might be of interest: https://csvkit.readthedocs.io/en/latest/index.html
#
# Usage:
#
# Exitcodes
# ==========
# 0     No error
# 2     Unknown flag/switch
# +10   Validation check errors
#



#bcp ${table} in ${filepath} -S ${server} -d ${database} -U ${user} -e err-${database}-${table}.out -c -t "|" -r "0x0a"

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

bcp -v # check that utility is installed

delimiter="|" # default delimiter is a pipe
filepath=""
while [[ $# > 0 ]]; do
    case $1 in
    -h | --help)
        echo 'USAGE: import-data.sh -S <server> -D <database> -T <table>  -u <user>  --delimiter "|" -f <filepathToCsv>'
        exit 0
        shift
        ;;

    --delimiter)
        delimiter="${2}"
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

    -T | --table)
        table="${2}"
        shift 2
        ;;

    -f | --filepath)
        filepath="${2}"
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

if [ -z "${filepath}" ]; then
    echo "Error: No file found at ${filepath}"
    exit 11
fi

# # create temporary copy of import file in current working directory
# cp ${filepath} ./${filepath}-tmp

if [[ "${delimiter}" == "," ]]; then
    echo "Convert delimiter [${delimiter}] to pipes"
    sed -Ee :1 -e 's/^(([^",]|"[^"]*")*),/\1|/;t1' < ./${filepath} 1> ${filepath}-tmp
    delimiter="|"
fi

if [[ "${delimiter}" != "|" ]]; then
    echo "Error: Unsupported delimiter [${delimiter}]"
    exit 12
fi

echo "Executing bcp command"

# bcp ${table} in ${filepath}-tmp \
#     -S ${server} -d ${database} -U ${user} \      # Database connection parameters. Password will be prompted
#     -e err-${database}-${table}.out \             # Output file with detail of errors
#     -c \                                          # Perform bcp operation using a character type. See docs for more details.
#     -t "|" \                                      # Choose a pipe (|) as the delimiter
#     -r "0x0a"                                     # Specify row terminator in hexadecimall format

bcp ${table} in ${filepath}-tmp -S ${server} -d ${database} -U ${user} -e err-${database}-${table}.out  -c -t "|" -r "0x0a"

echo "Completed exported command execution"
