const fs = require('fs');
const path = require('node:path')
const yaml = require('yaml');
yaml.scalarOptions.str.doubleQuoted = { jsonEncoding: true, minMultiLineLength: 40 };

const sdk = require('api')('https://docs.readme.com/developers/openapi/62056dee230e07007218be15');
sdk.auth('<API-KEY>');


const { writeFiles: exportDocs } = require('./writeFiles');

// const filterDocs = (docList) => {
// };

const categoryDocs = async (categorySlug) => {
    const docs = await sdk.getCategoryDocs({ slug: categorySlug }).then(res => res.data);
    return docs;
};

const getGuides = async (options = {}) => {
    const { excludeHidden = false, version } = options;
    const itemsPerPage = 20;

    const getNumberOfPages = async () => {
        return await sdk.getCategories({ perPage: itemsPerPage, 'x-readme-version': version })
            .then(res => {
                const totalCount = Math.ceil(parseInt(res.headers.get('x-total-count') || '0', 10) / itemsPerPage);
                return { firstPage: res.data, totalCount };
            })
            .catch(e => console.log(e));
    }

    try {

        const { firstPage, totalCount } = await getNumberOfPages();
        const allCategories = firstPage.concat(
            ...(await Promise.all(
                [...new Array(totalCount + 1).keys()].slice(2).map(async page => {
                    return await sdk.getCategories({ perPage: itemsPerPage, page }).then(res => res.data);
                })
            ))
        );

        const guideCategories = allCategories.filter(category => category.type === 'guide');

        const guideDocs = await Promise.all(
            guideCategories.map(async (category) => {
                const docs = await categoryDocs(category.slug).catch(e => console.log(e));

                let filteredDocs;

                if (excludeHidden) {
                    filteredDocs = docs.filter(doc => doc.hidden === false);

                    // make this more elegant 
                    filteredDocs.forEach(doc => {
                        if (doc.children?.length) {
                            doc.children = doc.children.filter(childPage => childPage.hidden === false);
                            if (doc.children.children?.length) {
                                doc.children.children = doc.children.children.filter(childPage => childPage.hidden === false);
                            }
                        }
                    });

                    docs.map(doc => {
                        if (doc.hidden === true) return;


                    })
                }
                return { category: category, docs: excludeHidden ? filteredDocs : docs };
            })
        );

        return guideDocs;
    } catch (e) {
        console.log(e);
        throw e;
    }
};

const getDocData = async (slug) => {
    const docData = await sdk.getDoc({ slug: slug }).then(res => res.data).catch(err => console.error(err));
    return docData;
}

getGuides({ excludeHidden: true })
    .then(guides => {
        const projectFolderName = path.join(__dirname, 'guides_export');
        fs.mkdirSync(projectFolderName);

        guides.forEach(guide => {
            if (!guide.docs.length) {
                return;
            }

            const categoryDir = projectFolderName + '/' + guide.category.title;
            fs.mkdirSync(categoryDir);

            guide.docs.forEach(doc => {
                exportDocs(doc, categoryDir, sdk, getDocData);
            });
        });
    })
    .catch(e => {
        console.log(e);
    });
