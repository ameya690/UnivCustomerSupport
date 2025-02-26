import mongoose, { Document, Schema } from 'mongoose';


export interface ICustomerAccount extends Document {
    phoneNumber: string;
    name: string;
    assistantName: string;
    website: string;
}

export interface IFaqInstance extends Document {
    question: string;
    answer: string;
    customerAccountString: string,
    customerAccount: mongoose.Types.ObjectId;
    embedding: number[]
    questionEmbedding: number[]
    answerEmbedding: number[]
}


const customerAccountSchema = new Schema<ICustomerAccount>({
    phoneNumber: { type: String, required: false },
    name: { type: String, required: false },
    assistantName: { type: String, required: false },
    website: { type: String, required: true , unique: true },
});


const faqInstanceSchema = new Schema<IFaqInstance>({
    question: { type: String, required: true },
    answer: { type: String, required: true },
    customerAccountString: { type: String, required: false },
    customerAccount: { type: Schema.Types.ObjectId, ref: 'CustomerAccount', required: true },
    embedding: { type: [Number], required: false },
    questionEmbedding: { type: [Number], required: false },
    answerEmbedding: { type: [Number], required: false },
});

const CustomerAccount = mongoose.models.CustomerAccount || mongoose.model<ICustomerAccount>('CustomerAccount', customerAccountSchema);
const FaqInstance = mongoose.models.FaqInstance || mongoose.model<IFaqInstance>('FaqInstance', faqInstanceSchema);

// Export the models
export { CustomerAccount, FaqInstance };
