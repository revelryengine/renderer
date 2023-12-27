/**
 * Unrolls a shader block by looping from 0 to n and concatenating a string and replacing all $$i with the index of the current loop iteration of n
 *
 * @param {string} input
 * @param {number} n
 */
export function unroll(input, n){
    let result = '';
    for(let i = 0; i < n; i++) {
        result += input.replaceAll('$$i', String(i)) + '\n';
    }
    return result;
}

export default unroll;
