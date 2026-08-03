import { useState, useEffect } from 'react';
import { endpoints } from '../api/api';

export default function useMacroEcoData() {
    const [data, setData] = useState({
        gdp: [],
        unemployment: [],
        payroll: [],
        confidence: [],
        cpi: [],
        retailSales: []
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [metadata, setMetadata] = useState({
        gdp: null,
        unemployment: null,
        payroll: null,
        confidence: null,
        cpi: null,
        retailSales: null
    });

    useEffect(() => {
        const fetchMacroEcoData = async () => {
            setLoading(true);
            setError(null);

            console.log('Starting macroeconomic data fetch...');

            try {
                const [gdpResponse, unemploymentResponse, payrollResponse, confidenceResponse, cpiResponse, retailSalesResponse] = await Promise.allSettled([
                    fetch(endpoints.macroeco.gdp),
                    fetch(endpoints.macroeco.employment),
                    fetch(endpoints.macroeco.payroll),
                    fetch(endpoints.macroeco.confidence),
                    fetch(endpoints.macroeco.cpi),
                    fetch(endpoints.macroeco.retailSales)
                ]);

                const processedData = {
                    gdp: [],
                    unemployment: [],
                    payroll: [],
                    confidence: [],
                    cpi: [],
                    retailSales: []
                };

                const processedMetadata = {
                    gdp: null,
                    unemployment: null,
                    payroll: null,
                    confidence: null,
                    cpi: null,
                    retailSales: null
                };

                if (gdpResponse.status === 'fulfilled' && gdpResponse.value?.ok) {
                    const gdpJson = await gdpResponse.value.json();
                    if (gdpJson.data) {
                        processedData.gdp = gdpJson.data.map(item => ({
                            date: item.date,
                            value: parseFloat(item.value || item.rate || 0),
                            time: item.date
                        }));
                        processedMetadata.gdp = gdpJson.metadata;
                        console.log('GDP data processed:', processedData.gdp.length, 'records');
                    }
                }

                if (unemploymentResponse.status === 'fulfilled' && unemploymentResponse.value?.ok) {
                    const unemploymentJson = await unemploymentResponse.value.json();
                    if (unemploymentJson.data) {
                        processedData.unemployment = unemploymentJson.data.map(item => ({
                            date: item.date,
                            value: parseFloat(item.value || item.rate || 0),
                            time: item.date
                        }));
                        processedMetadata.unemployment = unemploymentJson.metadata;
                        console.log('Unemployment data processed:', processedData.unemployment.length, 'records');
                    }
                }

                if (payrollResponse.status === 'fulfilled' && payrollResponse.value?.ok) {
                    const payrollJson = await payrollResponse.value.json();
                    if (payrollJson.data) {
                        processedData.payroll = payrollJson.data.map(item => ({
                            date: item.date,
                            value: parseFloat(item.value || item.rate || 0),
                            time: item.date
                        }));
                        processedMetadata.payroll = payrollJson.metadata;
                        console.log('Payroll data processed:', processedData.payroll.length, 'records');
                    }
                }

                if (confidenceResponse.status === 'fulfilled' && confidenceResponse.value?.ok) {
                    const confidenceJson = await confidenceResponse.value.json();
                    if (confidenceJson.data) {
                        processedData.confidence = confidenceJson.data.map(item => ({
                            date: item.date,
                            value: parseFloat(item.value || item.rate || 0),
                            time: item.date
                        }));
                        processedMetadata.confidence = confidenceJson.metadata;
                        console.log('Confidence data processed:', processedData.confidence.length, 'records');
                    }
                }

                if (cpiResponse.status === 'fulfilled' && cpiResponse.value?.ok) {
                    const cpiJson = await cpiResponse.value.json();
                    if (cpiJson.data) {
                        processedData.cpi = cpiJson.data.map(item => ({
                            date: item.date,
                            value: parseFloat(item.value || item.rate || 0),
                            time: item.date
                        }));
                        processedMetadata.cpi = cpiJson.metadata;
                        console.log('CPI data processed:', processedData.cpi.length, 'records');
                    }
                }

                if (retailSalesResponse.status === 'fulfilled' && retailSalesResponse.value?.ok) {
                    const retailSalesJson = await retailSalesResponse.value.json();
                    if (retailSalesJson.data) {
                        processedData.retailSales = retailSalesJson.data.map(item => ({
                            date: item.date,
                            value: parseFloat(item.value || item.rate || 0),
                            time: item.date
                        }));
                        processedMetadata.retailSales = retailSalesJson.metadata;
                        console.log('Retail Sales data processed:', processedData.retailSales.length, 'records');
                    }
                }

                setData(processedData);
                setMetadata(processedMetadata);

            } catch (err) {
                console.error('Error fetching macroeconomic data:', err);
                setError(err.message);
                setData({
                    gdp: [],
                    unemployment: [],
                    payroll: [],
                    confidence: [],
                    cpi: [],
                    retailSales: []
                });
                setMetadata({
                    gdp: null,
                    unemployment: null,
                    payroll: null,
                    confidence: null,
                    cpi: null,
                    retailSales: null
                });
            } finally {
                setLoading(false);
            }
        };

        fetchMacroEcoData();
    }, []);

    return { data, loading, error, metadata };
}