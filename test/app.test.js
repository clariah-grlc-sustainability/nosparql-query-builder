import { assert } from 'chai';
import axios from 'axios';

const test_case_1 = { 
    'endpoint' :  'http://dbpedia.org/sparql',
    'filters' :  [{
        'pred' : 'http://dbpedia.org/ontology/birthPlace',
        'obj' : 'http://dbpedia.org/resource/Calcutta'
    }, {
        'pred' : 'http://dbpedia.org/ontology/deathPlace',
        'obj' : 'http://dbpedia.org/resource/Calcutta'
    }],
    'show' : 'http://dbpedia.org/ontology/birthDate',
    'limit' : 8
}

async function executeSparqlQuery(test_data) {
    let query = `
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?subject ?showAttributeVal WHERE {
        `;

    const endpointUrl = test_data['endpoint'];

    console.log(endpointUrl);

    for (let i = 0; i < test_data['filters'].length; i++) {
        query += `?subject <${test_data['filters'][i]['pred']}> <${test_data['filters'][i]['obj']}> .\r\n`;
    }

    query += `?subject <${test_data['show']}> ?showAttributeVal .\r\n}`;
    query += `LIMIT ${test_data['limit']}\r\n`;

    if (query) {
        try {
            const response = await axios.get(endpointUrl, {
                params: {
                    query: query,
                    format: 'json'
                }
            });
            displayResults(response.data);
        } catch (error) {
            console.error('Error executing query:', error);
        }
    }
}

function displayResults(data) {
    const bindings = data.results.bindings;
    if (bindings.length > 0) {
        let table = '<table><tr>';
        for (const key in bindings[0]) {
            table += `<th>${key}</th>`;
        }
        table += '</tr>';
        let result_idx = 1;
        
        bindings.forEach(binding => {
            table += `<tr>`;
            let first_iteration = true;
            for (const key in binding) {
                if (first_iteration) {
                    table += `<td>${result_idx}. ${binding[key].value}</td>`;
                    first_iteration = false;
                    result_idx++;
                }
                else {
                    table += `<td>${binding[key].value}</td>`;
                    first_iteration = true;
                }   
            }
            table += '</tr>';
        });
        table += '</table>';
        console.log(table);
        console.log('\r\n');
    } else {
        console.log('No results found.');
    }
}

describe('Query execution', function () {
    it('Test case 1', function () {
        executeSparqlQuery(test_case_1);
    });
});