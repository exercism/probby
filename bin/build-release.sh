#!/bin/bash

branch_name="$(git symbolic-ref --short -q HEAD)"
repo="$1"
package="$2"
version="v$(jq -r .version actions/"$package"/package.json)"
full_version="$package@$version"

if [ -z "$repo" ]; then
    echo "ERROR: must specify repository"
    exit 1
fi

if [ -z "$package" ]; then
    echo "ERROR: must specify package"
    exit 1
fi

echo "=== debug info ==="
echo "branch: $branch_name"
echo "version: $version"
echo "full version: $full_version"
echo "repo: $repo"
echo "package: $package"
echo "=================="
echo ""

# Check that the version doesn't exist yet
version_exists="$(curl -s https://api.github.com/repos/"$repo"/tags -H "Accept: application/vnd.github.v3.full+json" | jq -r '.[] | select(.name == "'"$full_version"'") | .name')"
if [ -n "$version_exists" ]; then
    echo "ERROR: version $full_version already exists"
    exit 1
fi

if [[ $branch_name == 'main' ]]; then
    git checkout -b "releases/$package/$version"
else
    git checkout -b "releases/test/$branch_name/$package/$version"
fi

cd "actions/$package" || exit 1
npm install
npm run build
npm run test
npm run package

echo '!dist' >> .gitignore
git add dist
git add .gitignore
git commit -a -m "Add production dependencies & build"

# Tags
major_minor="$(sed 's/\.[^.]*$//' <<< "$version")"
major="$(sed 's/\.[^.]*$//' <<< "$major_minor")"

if [[ $branch_name == 'main' ]]; then
    git tag "$full_version"
    git tag -f "$package@$major_minor"
    git tag -f "$package@$major"
fi
