import { getUrl } from "../shared";
import { LcAxios } from "../utils/httpUtils";

const graphqlStr = `
    query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
            exampleTestcaseList
        }
    }
`;

export const queryExampleTestcases = async (titleSlug: string): Promise<string[]> => {
    const res = await LcAxios(getUrl("graphql"), {
        method: "POST",
        data: {
            query: graphqlStr,
            variables: { titleSlug },
        },
    });
    return res.data?.data?.question?.exampleTestcaseList || [];
};
