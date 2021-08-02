#! /bin/bash

gsutil rsync -r -d -x '.DS_Store' ./_site gs://www.asbra.org
