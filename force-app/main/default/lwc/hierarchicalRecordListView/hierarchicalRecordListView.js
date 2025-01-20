import { LightningElement,wire,api,track } from 'lwc';
import getChildRecords from '@salesforce/apex/HierarchicalViewController.getRelatedChildRecords';
import { getRelatedListsInfo } from "lightning/uiRelatedListApi";
import { getRecord } from 'lightning/uiRecordApi';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';

import {NavigationMixin} from 'lightning/navigation';


// matching/similar strings for some fields that make sense to be displayed
//const FIELD_CRITERIA = ['Email','Date','Time','Title','Type','Status','Priority', 'Amount','Phone'];
const FIELD_CRITERIA = ['Name','Number'];

export default class HierarchicalRecordListView extends NavigationMixin(LightningElement) {


    @api flexipageRegionWidth; // dynamic spacing between component

    //parent dynamic variables
    @api recordid; 
    @api parentobjectapiname;
    @api childobjectapiname;

    @api relatedListOptions;
   
    
    @track childRecords = [];
    @track viewableChildRecords = [];
    //@track relatedListsObjectAttributes;
    @track toDisplayFieldNames = [];

    // store expanded record information
     openedObjectRecordId;
     openedRecordFields;


    //relatedListsSummary;
    selectedRecordId;
    columnHeaderLabelsArr;

    recordClicked = false;
    //requireViewAll = false;
    showNoDataCard = false;
    isLoading = true;

    connectedCllback(){
        console.log('RELATED LIST OPTIONS '+this.relatedListOptions);
    }

    /*
    ********  wire methods below ***** 
    */



    /*Method: Apex wired method to fetch related records to the object
    * whoes recordId is being passed as parameter
    *
    * @param recordId: recordId of current object whose related records
    * are needed to be displayed
    * @param parentObjectApiName: objectApiName of the current object
    * @param childObjectApiName: objectApiName of the related (opened) object
    */

    @wire(getChildRecords,{recordId:'$recordid',parentObjectApiName:'$parentobjectapiname',childObjectApiName:'$childobjectapiname'})
        wiredChildRecord({error,data}){
            if(data) {
                if (Array.isArray(data) && data.length > 0) {
                this.childRecords = data;
                //for compactness we will display only 4 records on ui
                this.viewableChildRecords = this.childRecords.slice(0,4);

                console.log('VIEWABLE CHILD ::: '+JSON.stringify(this.viewableChildRecords));
        
                //providing a button to view all records if no. of records > 4
                // if(this.childRecords.length > 4) {
                //     this.requireViewAll = true
                // }

                //picking up the record id of a record to get object metadata 
                // for preparing datatable display fields - any record will do
                this.openedObjectRecordId = this.viewableChildRecords[0].id;
                this.showNoDataCard = false;

            }
            else {
                //handling empty data for child records
                console.log('No related records found');
                this.relatedRecords = [];
                this.showNoDataCard = true;
                this.recordClicked = false;
            }
            setTimeout(() => {
                this.isLoading = false;
            }, 400);
            }
            else if (error) {
            //console.error(error);
            console.log(error);
        }

    }


    /*  Method: wired method to fetch list of object
    *           and their attributes related to the supplied objectApiName
    *        
    *  @param parentObjectApiName: objectApiName of the opened related object
    */
    // @wire(getRelatedListsInfo, { parentObjectApiName: '$childobjectapiname'})
    // wiredRelatedLists({ error, data }) {
    //     if (data) {
    //         //console.log('Related Lists Data:', data);
    //         //this.relatedListsSummary = data.relatedLists; // Store the related lists data
    //         //console.log('Related List :'+this.relatedListsSummary);
    

    //         this.relatedListsObjectAttributes = data.relatedLists.map(item => ({
    //             label : item.entityLabel,
    //             value : item.entityLabel, // Use entityLabel as the value
    //             iconUrl : item.themeInfo.iconUrl,
    //             color : '#' + item.themeInfo.color,
    //             isVisible : false
    //         }));
    //         // console.log('Related list object attributes :'+JSON.stringify(this.relatedListsObjectAttributes));

    //     } 
    //     else if (error) {
    //         //console.error('Error fetching related lists:', error);
    //     }

    // }


    /*
    * Method: Standard Salesforce lightning method to fetch metadata of an object
    * whoes recordId is being passed as parameter
    *
    * @param recordId :  recordId of current object whose related fields
    * are neededs to be processed and displayed on UI
    */

    @wire(getRecord, { recordId: '$openedObjectRecordId', layoutTypes: ['Compact'] })
    wiredRecord({ error, data }) {
        if (data) {
            
            var recordData = data.fields; // Get field data
            console.log('WHOLE DATA ::: '+JSON.stringify(data));
            console.log('DATA FIELDS '+JSON.stringify(recordData));
            this.displayObject = this.filterAndModifyObject(recordData);


            // this.toDisplayFieldNames = Object.keys(this.displayObject).filter(key => {
            //     // Only keep the fields that have 'displayValue' and 'value' properties
            //     return this.displayObject[key]?.displayValue !== undefined && this.displayObject[key] ?. value !== undefined;
            // });

            this.toDisplayFieldNames = Object.keys(this.displayObject);


            console.log('DISPLAY FIELDS ' + JSON.stringify(this.filterAndModifyObject(recordData)));

            console.log('DISPLAY OBJ FIELDS ' + JSON.stringify(this.toDisplayFieldNames));

            this.columnHeaderLabelsArr = this.getLabelsFromAPINameArr(this.openedRecordFields,this.toDisplayFieldNames);

            console.log('COLUMN FIELDS ::: '+this.columnHeaderLabelsArr);


        } else if (error) { 
            console.error('Error retrieving record:', JSON.stringify(error));
        }
    }


    /* Method: Wired method to fetch object info to extract complete field 
    *         information, so that field label can be used on column header
    *
    * @param ojectApiName: objectApiName of the target object 
    */

    @wire(getObjectInfo, { objectApiName: '$childobjectapiname' })
    wireOpenRecord({ error, data }){
        if(data){
            console.log('OPEN RECORD FIELDS ::: '+JSON.stringify(data.fields));

                this.openedRecordFields = data.fields;
        
        }
        else{
            console.log('ERROR ::: '+JSON.stringify(error));
        }
        
    }

    /*
    ********  wire methods above ***** 
    */



    /*
    * Event handler for selection of particular related record
    */

    handleRecordSelection(event) {

        this.recordClicked = true;
        const clickedId = event.currentTarget.dataset.id; // Extract ID from data attribute
        console.log('Clicked ID:', clickedId);
        this.selectedRecordId = clickedId;
        this.selectedRecord = this.childRecords.find(record => record.id === clickedId);
        console.log('$$$ ' + JSON.stringify(this.selectedRecord));

        this.processSelectedRecordFields();

        const evt = new CustomEvent('recordselection', {
            detail: { id: event.currentTarget.dataset.id,
                     name : this.selectedRecord.name 
            }
        });
        this.dispatchEvent(evt);

    }

    /*
    * processing the fields of record selected on ui to show in expanded view
    */
    processSelectedRecordFields() {
        if (this.selectedRecord) {
            const selectedFields = {};
            // Iterate over filteredObjectFields and find corresponding data in selectedRecord
            this.filteredObjectFields.forEach(key => {
                // Match the field name (key) in selectedRecord and store its value
                const recordKey = key.toLowerCase(); // Convert key to lowercase to match the field names in selectedRecord
                if (this.selectedRecord[recordKey]) {
                    selectedFields[key] = this.selectedRecord[recordKey]; // Add it to selectedFields
                } else {
                    selectedFields[key] = ''; // If not found, set a placeholder value
                }
            });

            // Store the selected fields in selectedRecordFields
            this.selectedRecordFields = selectedFields;
        }
    }

    /*
    * Navigate to selecte record detail page 
    */ 
    handleRecordNavigation(event) {
        const clickedRecordId = event.currentTarget.dataset.id;
        const objectApiName = this.selectedRecord ? this.selectedRecord.apiName : this.childobjectapiname;

        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: this.selectedRecordId || clickedRecordId,  // The record ID to navigate to
                objectApiName: objectApiName,  // The object API name (e.g., 'Account', 'Contact')
                actionName: 'view'  // Use 'view' to view the record page
            }
        });
    }

    /*
    * Handle related record collaps action
    */ 
    handleRecordCollapse(event) {

        this.resetRecordClickActions();

        const evt = new CustomEvent('recordcollapse', {
            detail: { id : '', name : '' }
        });
        this.dispatchEvent(evt);

    }

    resetRecordClickActions(){
        this.recordClicked = false;
        this.selectedRecord = null;
        this.selectedRecordFields = {}; 
    }

    /*
    * Get the relationship object name as string for both Standard & Custom Objects
    *
    * @param: API name of child object
    */
    findRelationShipName(childObjApiName) {

        console.log('RELATED LIST OPTIONS  @@@ '+JSON.stringify(this.relatedListOptions));

        const relatedList = this.relatedListOptions.find(item => item.apiName === childObjApiName);

        // If a matching object is found, return the relatedListId; otherwise, return null or some default value
        if (relatedList) {
            return relatedList.relatedListId;
        } else {
            console.log('RelationShip Error : Invalid Relationship !!')
            return null; // or any default value you prefer if no match is found
        }
    }

    /*
    * Button 'View All' navigation
    *
    * @param : event of onclick on a primary field of an inline record
    */
    handleViewAll(evt) {

        console.log('recordid ' + this.recordid);
        console.log('parent object api name ' + this.parentobjectapiname);
        console.log('relationship name ' + this.findRelationShipName(this.childobjectapiname));

        this[NavigationMixin.Navigate]({
            type : 'standard__recordRelationshipPage',
            attributes : {
                recordId : this.recordid,  // The parent record ID
                objectApiName : this.parentobjectapiname,
                relationshipApiName : this.findRelationShipName(this.childobjectapiname),  // The dynamic relationship name
                actionName : 'view'  // View the related list
            }
        
        });
 
    }


    /*
    * Method - Filter and determining the fields to display
    * @param: inputObject contains Object's compact layout fields
    * @return : fields array to be used for fetching apiNames of fields to be displayed
    */
    filterAndModifyObject(inputObject) {
        let filteredFields = {};

        Object.keys(inputObject).forEach((key) => {
            const value = inputObject[key];

            //Below line ensures that relationship fields 
            // (which refer to related records, not actual field data of the record) 
            // are not included in the list of fields that should be displayed 
            // and not processed in the filterAndModifyObject method.
            if (key.includes('__r')) {
                return;
            }

            // Check if the key matches any of the criteria in FIELD_CRITERIA (case insensitive match)
            const matchesCriteria = FIELD_CRITERIA.some(criteria => 
            key.toLowerCase().includes(criteria.toLowerCase())
            );

            // If the key matches any of the FIELD_CRITERIA criteria, include it in filteredFields
            if (matchesCriteria && value) { 
                filteredFields[key] = value;
            } 
            // if value exist include rest of the fields as well 
            else if (value.value) { 
                filteredFields[key] = value;
            }
        });

        return filteredFields;
}

    /*
    * getter ensures unique keys and limit display fields to 4
    */
    // get filteredObjectFields() {
    //     return [...new Set(this.toDisplayFieldNames)].slice(0, 4);// Ensure unique keys and limit to 4
    
    // }

    filterFields(fields) {
        return [...new Set(fields)]
            .filter(key => !key.toLowerCase().includes('account'))  // Exclude any key with 'account'
            .slice(0, 4);  // Limit to 4 fields
    }
    

    /*
    * Syncing filteredObjectFields with columnHeaderLabels such that column label
    * dictates what record data needs to appear on ui
    */
    get filteredObjectFields() {
        // Filter fields based on column header labels
        return this.columnHeaderLabels.map(label => {
            // Find the field with a matching label from the toDisplayFieldNames
            const matchingField = this.toDisplayFieldNames.find(field => {
                const fieldData = this.openedRecordFields[field];
                return fieldData && fieldData.label === label;  // Ensure label matches
            });
            return matchingField;  // Return the matched field (if any)
        }).filter(Boolean); // Remove any null or undefined values
    }
    

    /*
    * explicitly removed account keyword to prevent irrelevant fields being included
    */
    get columnHeaderLabels(){
        return this.filterFields(this.columnHeaderLabelsArr);


    }

    /*
    * filtering records from viewableChildRecords object array
    * with the filtered fields by string matching 
    */

    get filteredRecords() {
        return this.viewableChildRecords.map((record) => {
            return {
                id: record.id,  // Ensure that each row has a unique ID
                values: this.filteredObjectFields.map((key) => {
                    var value = record[key.toLowerCase()]; // Dynamically access record properties
                    if (!value) {
                        value = '';  // Skip this field if the value is not available
                    }
                    return {
                        key: key,
                        value: value,
                        applyLink: (key.toLowerCase().includes('name') || key.toLowerCase().includes('number')) // Check for 'name' or 'number'
                    };
                }).filter(item => item !== null)  // Filter out any null values
            };
        }).filter(record => record.values.length > 0);  // Remove any records with no valid fields
    }
    
    /*
    * getter for the fields records to be displayed iteratively on ui markup
    */
    get displayedSelectedRecordFields() {
        // Return an array of objects to be used in the template
        return Object.keys(this.selectedRecordFields).map(key => {
            const value = this.selectedRecordFields[key];
 
            const applyLink = (key.toLowerCase().includes('name') || key.toLowerCase().includes('number'));
            return {
            key : key,
            value : value,
            applyLink : applyLink
            }
        });
    }

    /*
    * Method: To search for field label names from object with key
    * matching the api names present in array 
    * 
    * @param data : Fields object containing everything about each field of an sObject
    * @param apiName : Array containing filtered api names decided to be displayed on ui
    *
    * @returns : Array of field labels to be used in column header to display fields of
    *            selected object
    */

    getLabelsFromAPINameArr(FieldsData, apiNames) {
        const labels = [];
    
        // Iterate over the API names and check if they match any field in FieldsData
        apiNames.forEach(apiName => {
            const fieldData = FieldsData[apiName];
            if (fieldData && fieldData.label) {
                labels.push(fieldData.label);  // Add the label to the result array
            }
        });
    
        return labels;
    }
    
    /*
    * Control when to shoe view all button to see further related records
    */
    get showViewAllButton(){
        return this.childRecords && this.childRecords.length > 4 ? true : false;
    }

}