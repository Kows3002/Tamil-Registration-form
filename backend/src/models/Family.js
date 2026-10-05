const mongoose = require('mongoose')

const memberSchema = new mongoose.Schema({
  serialNumber: { type: Number, required: true }, nameAddress: { type: String, required: true, trim: true, maxlength: 600 },
  name: { type: String, trim: true, maxlength: 160 },
  idNumber: { type: String, trim: true, maxlength: 80 }, phoneNumber: { type: String, trim: true, maxlength: 24 },
  gender: { type: String, trim: true, maxlength: 20 }, age: { type: Number, min: 0, max: 120 }, maritalStatus: { type: String, trim: true, maxlength: 20 },
  education: { type: String, trim: true, maxlength: 100 }, familyIncome: { type: String, trim: true, maxlength: 80 },
  religion: { type: String, trim: true, maxlength: 60 }, governmentScheme: { type: String, trim: true, maxlength: 100 },
  residenceType: { type: String, trim: true, maxlength: 100 }, birthDate: { type: String, trim: true, maxlength: 20 },
  additionalPhone: { type: String, trim: true, maxlength: 24 }, governmentId: { type: String, trim: true, maxlength: 80 },
  remarks: { type: String, trim: true, maxlength: 500 }, workDetails: { type: String, trim: true, maxlength: 200 },
  centralGovernment: { type: Boolean, default: false }, stateGovernment: { type: Boolean, default: false }, private: { type: Boolean, default: false },
  villageName: { type: String, trim: true, maxlength: 120 }, temples: { type: String, trim: true, maxlength: 160 },
  templeBoard: { type: String, trim: true, maxlength: 200 }, temporaryAddress: { type: String, trim: true, maxlength: 500 },
  taxPayingVillage: { type: String, trim: true, maxlength: 120 }, familyAnnualIncome: { type: String, trim: true, maxlength: 100 },
}, { _id: true })

const familySchema = new mongoose.Schema({
  familyHeadName: { type: String, required: true, trim: true, maxlength: 160 }, villageName: { type: String, required: true, trim: true, maxlength: 120 },
  pitagaiName: { type: String, trim: true, maxlength: 160 }, localBody: String, townPanchayat: String, municipality: String, corporation: String,
  district: { type: String, required: true, trim: true, maxlength: 120 }, block: String, wardNumber: String, taluk: String, postalCode: String,
  postOffice: String, wardSerial: String, circle: String, revenueVillage: String, division: String,
  assemblyConstituency: String, parliamentConstituency: String, phoneNumber: { type: String, trim: true, maxlength: 24 }, surveyorName: String,
  members: { type: [memberSchema], validate: { validator: a => a.length > 0, message: 'At least one family member is required' } },
}, { timestamps: true, strict: true })

module.exports = mongoose.model('Family', familySchema)
