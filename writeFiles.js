const fs = require('fs');
const path = require('path')

const yaml = require('yaml');
yaml.scalarOptions.str.doubleQuoted = { jsonEncoding: true, minMultiLineLength: 40 };

// TODO: Add check for blank parent pages

async function writeFiles(doc, directory, sdk, getDocData) {
    // figure out why getDocData doesn't work here
    const docData = await sdk.getDoc({ slug: doc.slug }).then(res => res.data).catch(err => console.error(err));
    const yamlHeader = getYamlHeader(docData);

    let markdown;
    if (docData.link_url) {
        markdown = '---\n' + yamlHeader + '---\n' + 'Page type: link \n' + 'External link:' + docData.link_external + '\n' + 'URL: ' + docData.link_url;

    } else {
        markdown = '---\n' + yamlHeader + '---\n' + docData.body;
    }

    const filePath = directory + '/' + doc.slug.toLowerCase() + '.md';

    fs.writeFileSync(filePath, markdown, function (err) {
        if (err) return console.log(err);
    });

    if (doc.children.length) {
        const folderPath = directory + '/' + doc.title;
        fs.mkdirSync(folderPath);
        doc.children.forEach(async (subPage) => {
            writeSubPage(subPage, folderPath, getDocData);
            // check if there is a 3rd level of nesting and child page has a child. If so, repeat
            if (subPage.children) {
                // repeat
                subPage.children.forEach(page => {
                    writeSubPage(page, folderPath, getDocData);
                });
            }
        });
    };
};

async function writeSubPage(docObject, path, getDocData) {
    const childDoc = await getDocData(docObject.slug);
    const childDocPath = path + '/' + docObject.slug + '.md';

    const yamlHeader = getYamlHeader(childDoc);

    let markdown;

    if (childDoc.link_url) {
        markdown = '---\n' + yamlHeader + '---\n' + 'Page type: link\n' + 'External link:' + childDoc.link_external + '\n' + 'URL: ' + childDoc.link_url;

    } else {
        markdown = '---\n' + yamlHeader + '---\n' + childDoc.body;;
    }

    fs.writeFileSync(childDocPath, markdown, function (err) {
        if (err) return console.log(err);
    });
};

function getYamlHeader(pageData) {
    header = {
        'title': pageData.title,
        // 'type': pageData.type,
        'category': pageData.category,
        'slug': pageData.slug,
        'hidden': pageData.hidden,
        'order': pageData.order,
        'parentDoc': pageData.parentDoc,
    };

    if (pageData.type === 'error') {
        header.error = {
            'code': pageData.error.code
        };
    }

    const y = new yaml.Document();
    y.contents = header;

    return y.toString();
}

module.exports = { writeFiles };

