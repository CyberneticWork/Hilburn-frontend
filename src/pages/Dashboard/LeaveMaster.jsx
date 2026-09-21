


import React, { useState, useEffect } from "react";
import {
  Calendar,
  User,
  Briefcase,
  Clock,
  CheckCircle,
  Search,
  Building,
  FileText,
  X,
  AlertCircle,
} from "lucide-react";
import Swal from "sweetalert2";
import employeeService from "../../services/EmployeeDataService";
import {
  createLeave,
  createLeaveWithOverride, // Add this import
  getLeaveById,
  getLeaveEligibility,
  getLeaveTypes,
} from "../../services/LeaveMaster";
import { fetchLeaveCalendar } from "../../services/LeaveCalendar";
import DatePickerInput from "@components/DatePickerInput";
import { getCoveringColleagues } from "../../services/EmployeePortalService";

const LeaveMaster = ({ employeeProfile }) => {
  // State for form fields
  const [formData, setFormData] = useState({
    emp_id: "",
    attendanceNo: "",
    epfNo: "",
    employeeName: "",
    department: "",
    reportingDate: getCurrentDate(),
    leaveType: "",
    // Date selection (single day vs range) is separate from day unit (full/half/short)
    dateSelection: "single",
    leaveDateType: "fullDay",
    halfDayPeriod: "morning",
    shortLeaveSlot: "slot1",
    leaveDate: {
      single: getCurrentDate(),
      from: getCurrentDate(),
      to: getCurrentDate(),
    },
    reason: "",
    covering_employee_id: "",
  });

  // Loading and notification states
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [isLoadingLeaves, setIsLoadingLeaves] = useState(false);
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [leaveUsageData, setLeaveUsageData] = useState([]);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const [leaveLawInfo, setLeaveLawInfo] = useState(null);
  const [disabledDates, setDisabledDates] = useState([]);
  const [hoveredDate, setHoveredDate] = useState(null);

  // Add a new state to store employee data
  const [employeeData, setEmployeeData] = useState(null);
  const [coveringColleagues, setCoveringColleagues] = useState([]);
  const [coveringFilter, setCoveringFilter] = useState("");

  // Auto-fill logged-in employee details
  useEffect(() => {
    if (employeeProfile) {
      setEmployeeData(employeeProfile);
      setFormData(prev => ({
        ...prev,
        emp_id: employeeProfile.id || "",
        attendanceNo: employeeProfile.attendance_employee_no || "",
        epfNo: employeeProfile.epf || "",
        employeeName: employeeProfile.name_with_initials || "",
        department: employeeProfile.organization_assignment?.department?.name || "",
      }));

      // Fetch leave data for logged-in employee
      if (employeeProfile.id) {
        fetchLeaveTypes();
        fetchEmployeeLeaves(employeeProfile.id, employeeProfile);
      }
    }
  }, [employeeProfile]);

  useEffect(() => {
    let cancelled = false;
    const loadCovering = async () => {
      if (!employeeData?.id && !employeeProfile?.id) {
        setCoveringColleagues([]);
        return;
      }
      try {
        if (employeeProfile) {
          const d = await getCoveringColleagues();
          if (!cancelled) setCoveringColleagues(d.items || []);
          return;
        }
        const rows = await employeeService.fetchEmployees();
        const list = Array.isArray(rows) ? rows : rows?.data || [];
        const selfId = Number(employeeData?.id);
        const companyId =
          employeeData?.organization_assignment?.company_id ||
          employeeData?.organization_assignment?.company?.id;
        const filtered = list.filter((e) => {
          if (Number(e.id) === selfId) return false;
          if (!companyId) return true;
          const cid = e.organization_assignment?.company_id || e.organization_assignment?.company?.id;
          return !cid || String(cid) === String(companyId);
        });
        if (!cancelled) setCoveringColleagues(filtered);
      } catch {
        if (!cancelled) setCoveringColleagues([]);
      }
    };
    loadCovering();
    return () => {
      cancelled = true;
    };
  }, [employeeData?.id, employeeProfile]);

  const fetchLeaveTypes = async () => {
    console.log("Fetching leave types...");
    setIsLoading(true);
    try {
      const response = await getLeaveTypes();
      console.log("Leave types response: ", response);
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  }



  // Selected Date  fetch
  useEffect(() => {
    if (formData.attendanceNo) {
      let selectedDate = getCurrentDate();

      if (formData.dateSelection === "range" && formData.leaveDate.from) {
        selectedDate = formData.leaveDate.from;
      } else if (formData.leaveDate.single) {
        selectedDate = formData.leaveDate.single;
      }

      fetchLeaveUsage(formData.attendanceNo, selectedDate);
    }
  }, [formData.leaveDate.single, formData.leaveDate.from, formData.dateSelection, formData.attendanceNo]);





  // Helper function to get current date in YYYY-MM-DD format
  function getCurrentDate() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Earliest leave date allowed on the form (backdating from April 1 of this year)
  function getMinLeaveDate() {
    const year = new Date().getFullYear();
    return `${year}-04-01`;
  }

  // Function to format date for display
  function formatDate(dateInput) {
    if (!dateInput) return "";
    const date =
      typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    return date.toISOString().split("T")[0];
  }

  const getLeaveUnitValue = (dayUnit = formData.leaveDateType) => {
    if (dayUnit === "halfDay") return 0.5;
    if (dayUnit === "shortLeave") return 0.25;
    return 1;
  };

  const getLeaveCalendarDays = () => {
    if (formData.dateSelection === "single") return 1;
    const fromDate = new Date(formData.leaveDate.from);
    const toDate = new Date(formData.leaveDate.to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || toDate < fromDate) {
      return 0;
    }
    return Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 3600 * 24)) + 1;
  };

  const getRequestedLeaveDuration = () => {
    const calendarDays = getLeaveCalendarDays();
    const unit = getLeaveUnitValue();
    return Math.round(calendarDays * unit * 10000) / 10000;
  };

  const getLeaveUnitLabel = () => {
    if (formData.leaveDateType === "halfDay") return "Half Day (0.5)";
    if (formData.leaveDateType === "shortLeave") return "Short Leave (0.25)";
    return "Full Day (1)";
  };

  /*
  // Function to format leave record for display
    function formatLeaveRecord(leaveData) {
      let leaveDateDisplay = "";
  
      // 1. Duration එක අනිවාර්යයෙන්ම Number එකක් බවට පත් කිරීම (parseFloat)
      const actualDuration = parseFloat(leaveData.leave_duration) || 
                             (leaveData.is_short_leave ? 0.25 : (leaveData.is_half_day ? 0.5 : 1));
  
      if (leaveData.leave_date) {
        leaveDateDisplay = formatDate(leaveData.leave_date);
        
        // Short leave සහ Half leave වල period එක පෙන්වීම
        if (leaveData.is_short_leave || actualDuration === 0.25) {
          const slots = {
            "slot1": "8:30 AM - 10:30 AM",
            "slot2": "10:30 AM - 12:30 PM",
            "slot3": "1:30 PM - 3:30 PM",
            "slot4": "3:30 PM - 5:30 PM"
          };
          // Backend එකෙන් එන short_leave_slot එක අනුව පෙන්වයි
          if (leaveData.short_leave_slot) {
             leaveDateDisplay += ` (${slots[leaveData.short_leave_slot] || leaveData.short_leave_slot})`;
          }
        } else if (leaveData.is_half_day || actualDuration === 0.5) {
          // Half day එකේ Morning ද Afternoon ද යන්න පෙන්වයි
          if (leaveData.period) {
             leaveDateDisplay += ` (${leaveData.period})`;
          }
        }
      } else if (leaveData.leave_from && leaveData.leave_to) {
        leaveDateDisplay = `${formatDate(leaveData.leave_from)} to ${formatDate(
          leaveData.leave_to
        )}`;
        if (actualDuration > 1) {
          leaveDateDisplay += ` (${actualDuration} days)`;
        }
      }
  
      const hasOverLimit = leaveData.over_limit && leaveData.over_limit > 0;
  
      let cleanLeaveType = leaveData.leave_type || "";
      if (cleanLeaveType.includes("(Probat")) {
          cleanLeaveType = "Casual Leave";
      }
  
      // 2. Type එක (Full, Half, Short) තීරණය කිරීම (Parse කරපු actualDuration එකෙන්)
      let displayType = "Full Day";
      if (leaveData.is_short_leave || actualDuration === 0.25) {
        displayType = "Short Leave";
      } else if (leaveData.is_half_day || actualDuration === 0.5) {
        displayType = "Half Day";
      } else if (actualDuration > 1) {
        displayType = "Multiple Days";
      }
  
      return {
        id: leaveData.id,
        leaveDate: leaveDateDisplay, // <--- දැන් මෙතන Date එකත් එක්කම Morning/Time Slot එක වැටෙනවා
        reportDate: formatDate(leaveData.reporting_date),
        fullHalfDay: displayType, // <--- Short Leave, Half Day කියලා හරියටම වැටෙනවා
        leaveType: cleanLeaveType,
        status: leaveData.status,
        duration: actualDuration, 
        hasOverLimit: hasOverLimit,
        overLimit: hasOverLimit ? leaveData.over_limit : 0,
      };
    }
  */

  // Function to format leave record for display
  function formatLeaveRecord(leaveData) {
    let leaveDateDisplay = "";

    // 1. Duration එක අනිවාර්යයෙන්ම Number එකක් බවට පත් කිරීම (parseFloat)
    const actualDuration = parseFloat(leaveData.leave_duration) ||
      (leaveData.is_short_leave ? 0.25 : (leaveData.is_half_day ? 0.5 : 1));

    const slots = {
      slot1: "8:30 AM - 10:30 AM",
      slot2: "10:30 AM - 12:30 PM",
      slot3: "1:30 PM - 3:30 PM",
      slot4: "3:30 PM - 5:30 PM",
    };

    if (leaveData.leave_from && leaveData.leave_to) {
      leaveDateDisplay = `${formatDate(leaveData.leave_from)} to ${formatDate(leaveData.leave_to)}`;
      leaveDateDisplay += ` (${actualDuration} day(s))`;
      if (leaveData.is_half_day && leaveData.period) {
        leaveDateDisplay += ` · ${leaveData.period}`;
      }
      if (leaveData.is_short_leave && leaveData.short_leave_slot) {
        leaveDateDisplay += ` · ${slots[leaveData.short_leave_slot] || leaveData.short_leave_slot}`;
      }
    } else if (leaveData.leave_date) {
      leaveDateDisplay = formatDate(leaveData.leave_date);
      if (leaveData.is_short_leave) {
        if (leaveData.short_leave_slot) {
          leaveDateDisplay += ` (${slots[leaveData.short_leave_slot] || leaveData.short_leave_slot})`;
        }
      } else if (leaveData.is_half_day && leaveData.period) {
        leaveDateDisplay += ` (${leaveData.period})`;
      }
    }

    const nopayDays = parseFloat(leaveData.nopay_days ?? 0) || 0;
    const hasNopay = nopayDays > 0 || (leaveData.over_limit && leaveData.over_limit > 0);
    const overLimitVal = nopayDays > 0 ? nopayDays : (hasNopay ? leaveData.over_limit : 0);
    const requestedDays = parseFloat(leaveData.requested_days ?? leaveData.leave_duration) || actualDuration;
    const leaveBalanceDays =
      leaveData.leave_balance_days != null
        ? parseFloat(leaveData.leave_balance_days)
        : Math.max(0, requestedDays - overLimitVal);

    let cleanLeaveType = leaveData.leave_type || "";
    if (cleanLeaveType.includes("(Probat")) {
      cleanLeaveType = "Casual Leave";
    }

    // 2. Type එක (Full, Half, Short) තීරණය කිරීම — flags win over duration
    let displayType = "Full Day";
    if (leaveData.is_short_leave) {
      displayType = actualDuration > 0.25 ? `Short Leave × range (${actualDuration}d)` : "Short Leave";
    } else if (leaveData.is_half_day) {
      displayType = actualDuration > 0.5 ? `Half Day × range (${actualDuration}d)` : "Half Day";
    } else if (actualDuration > 1) {
      displayType = "Multiple Days";
    }

    return {
      id: leaveData.id,
      leaveDate: leaveDateDisplay, // <--- දැන් මෙතන Date එකත් එක්කම Morning/Time Slot එක වැටෙනවා
      reportDate: formatDate(leaveData.reporting_date),
      fullHalfDay: displayType, // <--- Short Leave, Half Day කියලා හරියටම වැටෙනවා
      leaveType: cleanLeaveType,
      status: leaveData.status,
      duration: actualDuration,
      requestedDays,
      leaveBalanceDays,
      hasOverLimit: hasNopay,
      overLimit: overLimitVal,
      nopayDays: overLimitVal,
      nopayApplied: !!leaveData.nopay_applied,
    };
  }


  // Update the getDisabledDates function to check company ID
  const getDisabledDates = (calendarData, employeeCompanyId) => {
    const dates = [];

    if (!employeeCompanyId) return dates;

    calendarData.forEach((leave) => {
      // Only process leaves that match the employee's company
      if (leave.company_id === employeeCompanyId && leave.start_date) {
        const start = new Date(leave.start_date);
        const end = leave.end_date
          ? new Date(leave.end_date)
          : new Date(leave.start_date);
        for (
          let date = new Date(start);
          date <= end;
          date.setDate(date.getDate() + 1)
        ) {
          dates.push(formatDate(new Date(date)));
        }
      }
    });
    return dates;
  };

  // Enhanced date input handler with validation
  const handleDateChange = (e) => {
    const { name, value } = e.target;

    // Check if this is a date field
    if (name.includes("leaveDate")) {
      // Check if the selected date is disabled
      if (disabledDates.includes(value)) {
        // Show error message
        Swal.fire({
          icon: "error",
          title: "Date Not Available",
          html: `
            <div class="text-left">
              <p>This date (${formatDateForDisplay(
            value
          )}) is not available for leave requests because:</p>
              <ul class="list-disc pl-5 mt-2">
                <li>It's marked as an event day</li>
                <li>Or it's already booked as leave</li>
              </ul>
              <p class="mt-3 text-sm">Please select a different date.</p>
            </div>
          `,
          confirmButtonColor: "#3085d6",
          confirmButtonText: "Ok, I understand",
          customClass: {
            popup: "rounded-xl",
            confirmButton: "rounded-lg text-sm px-5 py-2.5",
          },
        });
        return; // Don't update the state
      }
    }

    // Handle nested objects in state (like leaveDate.single, leaveDate.from, etc.)
    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setFormData({
        ...formData,
        [parent]: {
          ...formData[parent],
          [child]: value,
        },
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  // Format date for display in error messages
  const formatDateForDisplay = (dateString) => {
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Function to check if a date is disabled
  const isDateDisabled = (dateString) => {
    return disabledDates.includes(dateString);
  };

  // Function to get date input styling based on disabled status
  const getDateInputStyle = (dateString) => {
    const baseStyle =
      "w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200";

    if (isDateDisabled(dateString)) {
      return `${baseStyle} bg-red-50 border-red-300 text-red-700 cursor-not-allowed`;
    }

    return `${baseStyle} border-gray-300`;
  };

  // Function to get date hover tooltip content
  const getDateHoverContent = (dateString) => {
    if (!isDateDisabled(dateString)) return null;

    return (
      <div className="absolute z-10 bottom-full mb-2 left-0 bg-red-600 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
        <AlertCircle className="inline mr-1 w-3 h-3" />
        Unavailable date (event or existing leave)
      </div>
    );
  };

  // Function to fetch employee leaves and calendar data (to set disabled dates)
  const fetchEmployeeLeaves = async (employeeId, empData) => {
    if (!employeeId) return;

    setIsLoadingLeaves(true);
    try {
      const [leaveData, calendarData] = await Promise.all([
        getLeaveById(employeeId),
        fetchLeaveCalendar(),
      ]);

      // Get employee's company ID from organization assignment
      const employeeCompanyId = empData?.organization_assignment?.company?.id;

      // Set disabled dates only for matching company
      const disabledDatesArray = getDisabledDates(
        calendarData,
        employeeCompanyId
      );
      setDisabledDates(disabledDatesArray);

      if (leaveData && Array.isArray(leaveData)) {
        const formattedLeaves = leaveData.map(formatLeaveRecord);
        setLeaveRecords(formattedLeaves);
      } else {
        setLeaveRecords([]);
      }
    } catch (error) {
      console.error("Error fetching employee leaves:", error);
      Swal.fire({
        icon: "error",
        title: "Data Fetch Error",
        text: "Failed to fetch leave records. Please try again.",
        confirmButtonColor: "#3085d6",
      });
      setLeaveRecords([]);
    } finally {
      setIsLoadingLeaves(false);
    }
  };

  // Function to fetch employee leave eligibility - uses dynamic leave types from API
  const fetchLeaveUsage = async (empNumber, targetDate = null) => {
    if (!empNumber) return;

    setIsLoadingUsage(true);
    try {
      // මෙතන තමයි වෙනස! දෙවෙනි එකට null දීලා, තුන්වෙනි එකට targetDate එක යවන්න.
      const eligibilityData = await getLeaveEligibility(empNumber, null, targetDate);

      console.log(eligibilityData);
      console.log("empNumber sent:", empNumber, "date sent:", targetDate);

      if (eligibilityData && eligibilityData.eligible_leaves && Array.isArray(eligibilityData.eligible_leaves)) {
        const formattedUsage = eligibilityData.eligible_leaves.map(
          (leave, index) => {
            let totalDays = Number(leave.total_days || 0);
            let usedDays = Number(leave.used_days || 0);

            if (usedDays > totalDays) {
              usedDays = totalDays;
            }

            let balanceDays = totalDays - usedDays;
            if (balanceDays < 0) balanceDays = 0;

            const formatNumber = (num) => Number(num.toFixed(2)).toString();

            return {
              id: index + 1,
              leaveType: leave.leave_type,
              total: formatNumber(totalDays),
              usage: formatNumber(usedDays),
              balance: formatNumber(balanceDays),
              isHalfDayOnly: leave.is_half_day_only,
              note: leave.note,
            };
          }
        );
        setLeaveUsageData(formattedUsage);
        setLeaveLawInfo({
          lawReference: eligibilityData.law_reference || "Shop and Office Employees Act No. 19 of 1954 (Sri Lanka)",
          balanceSource: eligibilityData.balance_source || "shop_and_office_act",
          employmentYear: eligibilityData.employment_year,
          calendarYear: eligibilityData.calendar_year,
          joinDate: eligibilityData.join_date,
          isFirstYear: eligibilityData.is_first_year,
          isSecondYear: eligibilityData.is_second_year,
          actAccrualEnabled: !!eligibilityData.act_accrual_enabled,
          actAccrualStartsOn: eligibilityData.act_accrual_starts_on || "2026-12-31",
          message: eligibilityData.message || "",
        });
      } else {
        setLeaveUsageData([]);
        setLeaveLawInfo(null);
      }
    } catch (error) {
      console.error("Error fetching leave eligibility data:", error);
      setLeaveUsageData([]);
      setLeaveLawInfo(null);
    } finally {
      setIsLoadingUsage(false);
    }
  };




  // Function to fetch employee details using the API
  const fetchEmployeeDetails = async () => {
    if (!formData.attendanceNo) {
      Swal.fire({
        icon: "error",
        title: "Input Required",
        text: "Please enter an employee number",
        confirmButtonColor: "#3085d6",
      });
      return;
    }

    setIsLoading(true);
    setSearchError("");

    try {
      const empData = await employeeService.searchByAttendanceNo(
        formData.attendanceNo
      );

      if (empData) {
        // Store the full employee data
        setEmployeeData(empData);

        setFormData({
          ...formData,
          emp_id: empData.id || "",
          epfNo: empData.epf || "",
          employeeName: empData.name_with_initials || "",
          department: empData.organization_assignment?.department?.name || "",
        });

        await Promise.all([
          fetchEmployeeLeaves(empData.id, empData),
          fetchLeaveUsage(empData.attendance_employee_no || formData.attendanceNo),
          fetchLeaveTypes(),
        ]);
      } else {
        Swal.fire({
          icon: "error",
          title: "Employee Not Found",
          text: "No employee found with the provided number",
          confirmButtonColor: "#3085d6",
        });
        setLeaveRecords([]);
        setEmployeeData(null);
        setLeaveUsageData([]);
      }
    } catch (error) {
      console.error("Error fetching employee data:", error);

      if (error.response?.data?.message) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.response.data.message,
          confirmButtonColor: "#3085d6",
        });
      } else if (error.response?.data) {
        showValidationErrors(error.response.data);
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to retrieve employee data. Please try again.",
          confirmButtonColor: "#3085d6",
        });
      }
      setLeaveRecords([]);
      setEmployeeData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Add this function at the top level of your component
  const showValidationErrors = (errors) => {
    const list = [];
    const walk = (value) => {
      if (value == null || value === "") return;
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (typeof value === "object") {
        Object.entries(value).forEach(([key, item]) => {
          if (["trace", "exception", "file", "line"].includes(key)) return;
          walk(item);
        });
        return;
      }
      const text = String(value);
      if (text && text !== "undefined") list.push(text);
    };
    walk(errors);
    const errorList = list.map((error) => `<li class="text-left">${error}</li>`).join("");

    Swal.fire({
      icon: "error",
      title: "Cannot submit leave",
      html: `
        <div>
          <ul class="list-disc pl-4 mt-2">
            ${errorList || "<li>Please check the form and try again.</li>"}
          </ul>
        </div>
      `,
      confirmButtonColor: "#3085d6",
      customClass: {
        container: "font-sans",
        popup: "rounded-xl",
        confirmButton: "rounded-lg text-sm px-5 py-2.5",
      },
    });
  };




  /*
  // Handle form submission for leave requests - modified to validate leave balance
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess(false);
    setIsSubmitting(true);
  
    // If all main identifying fields are empty, show same error as for missing employee number
    const allEmpty =
      !formData.attendanceNo &&
      !formData.epfNo &&
      !formData.employeeName &&
      !formData.department;
  
    if (allEmpty) {
      Swal.fire({
        icon: "error",
        title: "Input Required",
        text: "Please enter an employee number",
        confirmButtonColor: "#3085d6",
      });
      setIsSubmitting(false);
      return;
    }
  
    try {
      // First validate all selected dates
      let invalidDates = [];
  
      if (formData.leaveDateType === "fullDay") {
        if (isDateDisabled(formData.leaveDate.single)) {
          invalidDates.push(formData.leaveDate.single);
        }
      } else if (formData.leaveDateType === "halfDay") {
        if (isDateDisabled(formData.leaveDate.single)) {
          invalidDates.push(formData.leaveDate.single);
        }
      } else if (formData.leaveDateType === "manual") {
        // Check each date in the range
        const fromDate = new Date(formData.leaveDate.from);
        const toDate = new Date(formData.leaveDate.to);
  
        // Validate date range (to date should be after or equal to from date)
        if (toDate < fromDate) {
          Swal.fire({
            icon: "error",
            title: "Invalid Date Range",
            text: "End date cannot be before start date",
            confirmButtonColor: "#3085d6",
          });
          setIsSubmitting(false);
          return;
        }
  
        for (
          let d = new Date(fromDate);
          d <= toDate;
          d.setDate(d.getDate() + 1)
        ) {
          const dateStr = formatDate(d);
          if (isDateDisabled(dateStr)) {
            invalidDates.push(dateStr);
          }
        }
      }
  
      if (invalidDates.length > 0) {
        Swal.fire({
          icon: "error",
          title: "Invalid Date Selection",
          html: `
          <div class="text-left">
            <p>The following selected dates are not available:</p>
            <ul class="list-disc pl-5 mt-2">
              ${invalidDates
                .map((d) => `<li>${formatDateForDisplay(d)}</li>`)
                .join("")}
            </ul>
            <p class="mt-3 text-sm">Please adjust your leave dates and try again.</p>
          </div>
        `,
          confirmButtonColor: "#3085d6",
          confirmButtonText: "Ok, I understand",
        });
        return;
      }
  
      let leaveData = {
        employee_id: parseInt(employeeData.id),
        reporting_date: formData.reportingDate,
        leave_type: formData.leaveType,
        reason: formData.reason,
        status: "Pending",
        leave_date: null,
        leave_from: null,
        leave_to: null,
        period: null,
        is_half_day: false,
        is_short_leave: false,
        short_leave_slot: null,
        leave_duration: 0
      };
  
      if (formData.leaveDateType === "fullDay") {
        leaveData.leave_date = formData.leaveDate.single;
        leaveData.is_half_day = false;
        leaveData.leave_duration = 1;
      } else if (formData.leaveDateType === "halfDay") {
        leaveData.leave_date = formData.leaveDate.single;
        leaveData.period =
          formData.halfDayPeriod === "morning" ? "Morning" : "Afternoon";
        leaveData.is_half_day = true;
        leaveData.leave_duration = 0.5;
      } else if (formData.leaveDateType === "shortLeave") {
        leaveData.leave_date = formData.leaveDate.single;
        leaveData.is_short_leave = true;
        leaveData.short_leave_slot = formData.shortLeaveSlot;
        leaveData.leave_duration = 0.25;
      } else if (formData.leaveDateType === "manual") {
        leaveData.leave_from = formData.leaveDate.from;
        leaveData.leave_to = formData.leaveDate.to;
        leaveData.is_half_day = false;
  
        // Calculate duration for date range
        const fromDate = new Date(formData.leaveDate.from);
        const toDate = new Date(formData.leaveDate.to);
        const timeDiff = toDate.getTime() - fromDate.getTime();
        const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
        leaveData.leave_duration = dayDiff;
      }
  
      try {
        await createLeave(leaveData);
  
        // Show success message
        Swal.fire({
          icon: "success",
          title: "Success",
          text: "Leave request submitted successfully!",
          confirmButtonColor: "#3085d6",
        });
  
        await handleSubmitSuccess();
      } catch (error) {
        // Check if this is a limit exceeded error that allows continuation
        if (
          error.response?.status === 422 &&
          error.response?.data?.limit_exceeded &&
          error.response?.data?.continue_allowed
        ) {
          // Show warning with continue option
          const result = await Swal.fire({
            icon: "warning",
            title: "Leave Limitation",
            html: `
              <div class="text-left">
                <p>${error.response.data.message}</p>
                <p class="mt-3">Do you want to continue with this request anyway?</p>
                <p class="mt-2 text-xs text-gray-500">
                  Note: Continuing will mark this leave with an override status
                </p>
              </div>
            `,
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Continue Anyway",
            cancelButtonText: "Cancel Request",
          });
  
          if (result.isConfirmed) {
            // User wants to continue - resubmit with force_continue flag
            try {
              await createLeaveWithOverride(leaveData);
  
              Swal.fire({
                icon: "success",
                title: "Leave Request Submitted",
                text: "Your leave request has been submitted with the noted limitation.",
                confirmButtonColor: "#3085d6",
              });
  
              await handleSubmitSuccess();
            } catch (innerError) {
              handleSubmitError(innerError);
            }
          } else {
            // User canceled the request
            setIsSubmitting(false);
          }
          return;
        }
  
        // Handle other errors
        handleSubmitError(error);
      }
    } catch (error) {
      handleSubmitError(error);
    }
  };
  */

  // Handle form submission for leave requests - modified to validate leave balance
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess(false);
    setIsSubmitting(true);

    // If all main identifying fields are empty, show same error as for missing employee number
    const allEmpty =
      !formData.attendanceNo &&
      !formData.epfNo &&
      !formData.employeeName &&
      !formData.department;

    if (allEmpty) {
      Swal.fire({
        icon: "error",
        title: "Input Required",
        text: "Please enter an employee number",
        confirmButtonColor: "#3085d6",
      });
      setIsSubmitting(false);
      return;
    }

    if (!formData.covering_employee_id) {
      Swal.fire({
        icon: "error",
        title: "Covering person required",
        text: "Select a covering person. Use search if the list is long.",
        confirmButtonColor: "#3085d6",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // First validate all selected dates
      let invalidDates = [];

      if (formData.dateSelection === "single") {
        if (isDateDisabled(formData.leaveDate.single)) {
          invalidDates.push(formData.leaveDate.single);
        }
      } else {
        const fromDate = new Date(formData.leaveDate.from);
        const toDate = new Date(formData.leaveDate.to);

        if (toDate < fromDate) {
          Swal.fire({
            icon: "error",
            title: "Invalid Date Range",
            text: "End date cannot be before start date",
            confirmButtonColor: "#3085d6",
          });
          setIsSubmitting(false);
          return;
        }

        for (
          let d = new Date(fromDate);
          d <= toDate;
          d.setDate(d.getDate() + 1)
        ) {
          const dateStr = formatDate(d);
          if (isDateDisabled(dateStr)) {
            invalidDates.push(dateStr);
          }
        }
      }

      if (invalidDates.length > 0) {
        Swal.fire({
          icon: "error",
          title: "Invalid Date Selection",
          html: `
          <div class="text-left">
            <p>The following selected dates are not available:</p>
            <ul class="list-disc pl-5 mt-2">
              ${invalidDates
              .map((d) => `<li>${formatDateForDisplay(d)}</li>`)
              .join("")}
            </ul>
            <p class="mt-3 text-sm">Please adjust your leave dates and try again.</p>
          </div>
        `,
          confirmButtonColor: "#3085d6",
          confirmButtonText: "Ok, I understand",
        });
        setIsSubmitting(false);
        return;
      }

      // ===================================================================
      // අලුතින් එකතු කළ කොටස: Balance එකට වඩා නිවාඩු දාන එක Block කිරීම
      // ===================================================================

      // 1. calendar days × full(1) / half(0.5) / short(0.25)
      let requestedDuration = getRequestedLeaveDuration();
      if (!requestedDuration || requestedDuration <= 0) {
        Swal.fire({
          icon: "error",
          title: "Invalid leave dates",
          text: "Please select a valid date or date range.",
          confirmButtonColor: "#3085d6",
        });
        setIsSubmitting(false);
        return;
      }

      // 2. තෝරපු Leave Type එකේ Balance එක හොයාගන්නවා
      const selectedLeaveInfo = leaveUsageData.find(item => item.leaveType === formData.leaveType);

      if (!formData.leaveType) {
        Swal.fire({
          icon: "error",
          title: "Leave Type Required",
          text: "Please select a leave type before submitting.",
          confirmButtonColor: "#3085d6",
        });
        setIsSubmitting(false);
        return;
      }

      if (selectedLeaveInfo) {
        const availableBalance = parseFloat(selectedLeaveInfo.balance);
        const entitledTotal = parseFloat(selectedLeaveInfo.total);
        const usedDays = parseFloat(selectedLeaveInfo.usage);
        const actNote = selectedLeaveInfo.note || "";

        // Combined Annual + Casual: e.g. need 1 day, have 0.5 Annual + 0.5 Casual
        const annualInfo = leaveUsageData.find((item) =>
          String(item.leaveType || "").toLowerCase().includes("annual")
        );
        const casualInfo = leaveUsageData.find((item) =>
          String(item.leaveType || "").toLowerCase().includes("casual")
        );
        const annualAvail = parseFloat(annualInfo?.balance ?? 0) || 0;
        const casualAvail = parseFloat(casualInfo?.balance ?? 0) || 0;
        const combinedAvail = annualAvail + casualAvail;
        const isAnnualOrCasual =
          String(formData.leaveType || "").toLowerCase().includes("annual") ||
          String(formData.leaveType || "").toLowerCase().includes("casual");

        if (requestedDuration > availableBalance) {
          const preferred = String(formData.leaveType || "").toLowerCase().includes("annual")
            ? "Annual Leave"
            : "Casual Leave";
          const other = preferred === "Annual Leave" ? "Casual Leave" : "Annual Leave";
          const preferredAvail = preferred === "Annual Leave" ? annualAvail : casualAvail;
          const otherAvail = preferred === "Annual Leave" ? casualAvail : annualAvail;
          const fromPreferred = Math.min(requestedDuration, preferredAvail);
          const fromOther = Math.min(
            Math.round((requestedDuration - fromPreferred) * 10000) / 10000,
            otherAvail
          );
          const nopayPart = Math.round((requestedDuration - fromPreferred - fromOther) * 10000) / 10000;

          // Annual/Casual: use both balances when the selected type alone is short
          if (isAnnualOrCasual && fromOther > 0.0001) {
            const confirmSplit = await Swal.fire({
              icon: nopayPart > 0.0001 ? "warning" : "info",
              title: nopayPart > 0.0001
                ? "Use combined balances + NoPay?"
                : "Use combined leave balances?",
              html: `
                <div class="text-left text-sm">
                  <p><b>${formData.leaveType}</b> alone has only <b>${availableBalance}</b> day(s).</p>
                  <p class="mt-2">Requested: <b>${requestedDuration}</b> day(s)</p>
                  <p class="mt-2">Available:</p>
                  <ul class="list-disc pl-5 mt-1">
                    <li>Annual: <b>${annualAvail}</b> day(s)</li>
                    <li>Casual: <b>${casualAvail}</b> day(s)</li>
                    <li>Combined: <b>${combinedAvail}</b> day(s)</li>
                  </ul>
                  <p class="mt-3">This leave will be applied as:</p>
                  <ul class="list-disc pl-5 mt-1">
                    <li><b>${fromPreferred}</b> day(s) from ${preferred}</li>
                    <li><b>${fromOther}</b> day(s) from ${other}</li>
                    ${nopayPart > 0.0001 ? `<li><b>${nopayPart}</b> day(s) as NoPay on HR approve</li>` : ""}
                  </ul>
                </div>
              `,
              showCancelButton: true,
              confirmButtonText: nopayPart > 0.0001
                ? "Submit (split + NoPay)"
                : "Yes, use both balances",
              cancelButtonText: "Cancel",
              confirmButtonColor: nopayPart > 0.0001 ? "#c2410c" : "#0f766e",
            });

            if (!confirmSplit.isConfirmed) {
              setIsSubmitting(false);
              return;
            }
            // Continue submit — backend will create split leave records (+ NoPay row if needed)
          } else {
            let reasonText = actNote;
            if (entitledTotal <= 0) {
              reasonText = actNote || `No ${formData.leaveType} balance available for this period.`;
            } else if (availableBalance <= 0) {
              reasonText = `All ${formData.leaveType} is already used (${usedDays}/${entitledTotal} days). ${actNote}`.trim();
            } else {
              reasonText = `Requested ${requestedDuration} day(s) but only ${availableBalance} day(s) remain (entitled ${entitledTotal}, used ${usedDays}). ${actNote}`.trim();
            }

            // For Annual/Casual with no other balance, still show combined for clarity
            const leaveCovered = isAnnualOrCasual
              ? Math.max(0, Math.min(requestedDuration, combinedAvail))
              : Math.max(0, Math.min(requestedDuration, availableBalance));
            const nopayPreview = Math.round((requestedDuration - leaveCovered) * 10000) / 10000;

            if (isAnnualOrCasual && combinedAvail > 0) {
              reasonText += ` Combined Annual (${annualAvail}) + Casual (${casualAvail}) = ${combinedAvail} day(s).`;
            }

            const confirmNopay = await Swal.fire({
              icon: "warning",
              title: "Insufficient leave balance",
              html: `
                <div class="text-left text-sm">
                  <p>You can still submit this leave.</p>
                  <p class="mt-2">Leave type: <b>${formData.leaveType}</b></p>
                  <p>Requested: <b>${requestedDuration}</b> day(s)</p>
                  <p>Available (${formData.leaveType}): <b>${availableBalance}</b> day(s)</p>
                  ${isAnnualOrCasual ? `<p>Combined Annual + Casual: <b>${combinedAvail}</b> day(s)</p>` : ""}
                  <p class="mt-3"><b>On HR approve:</b></p>
                  <ul class="list-disc pl-5 mt-1">
                    <li><b>${leaveCovered}</b> day(s) from leave balance</li>
                    <li><b>${nopayPreview}</b> day(s) as NoPay deduction</li>
                  </ul>
                  <p class="mt-3 text-xs text-gray-600">${reasonText}</p>
                </div>
              `,
              showCancelButton: true,
              confirmButtonText: "Submit (NoPay on approve)",
              cancelButtonText: "Cancel",
              confirmButtonColor: "#c2410c",
            });

            if (!confirmNopay.isConfirmed) {
              setIsSubmitting(false);
              return;
            }
          }
        }
      } else if (leaveUsageData.length > 0) {
        const confirmUnknownType = await Swal.fire({
          icon: "warning",
          title: "Leave type not in balance list",
          html: `
            <div class="text-left text-sm">
              <p><b>${formData.leaveType}</b> is not in the current leave balances.</p>
              <p class="mt-2">You can still submit. On HR approve, the full <b>${requestedDuration}</b> day(s) will be treated as NoPay.</p>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: "Submit as NoPay",
          cancelButtonText: "Cancel",
          confirmButtonColor: "#c2410c",
        });
        if (!confirmUnknownType.isConfirmed) {
          setIsSubmitting(false);
          return;
        }
      } else {
        // No balances loaded (e.g. 2026 manual-only year before Act start)
        const confirmNoBalance = await Swal.fire({
          icon: "warning",
          title: "No leave balance found",
          html: `
            <div class="text-left text-sm">
              <p>No leave balances are available for this employee/year.</p>
              <p class="mt-2">You can still submit. On HR approve, <b>${requestedDuration}</b> day(s) will be treated as NoPay unless HR has entered balances.</p>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: "Submit anyway",
          cancelButtonText: "Cancel",
          confirmButtonColor: "#c2410c",
        });
        if (!confirmNoBalance.isConfirmed) {
          setIsSubmitting(false);
          return;
        }
      }
      // ===================================================================

      let leaveData = {
        employee_id: parseInt(employeeData.id),
        reporting_date: formData.reportingDate,
        leave_type: formData.leaveType,
        reason: formData.reason,
        status: "Pending",
        leave_date: null,
        leave_from: null,
        leave_to: null,
        period: null,
        is_half_day: false,
        is_short_leave: false,
        short_leave_slot: null,
        leave_duration: requestedDuration, // කලින් හදපු duration එක මෙතනට දෙනවා
        covering_employee_id: formData.covering_employee_id || null,
      };

      const isHalf = formData.leaveDateType === "halfDay";
      const isShort = formData.leaveDateType === "shortLeave";
      leaveData.is_half_day = isHalf;
      leaveData.is_short_leave = isShort;
      if (isHalf) {
        leaveData.period = formData.halfDayPeriod === "morning" ? "Morning" : "Afternoon";
      }
      if (isShort) {
        leaveData.short_leave_slot = formData.shortLeaveSlot;
      }

      if (formData.dateSelection === "single") {
        leaveData.leave_date = formData.leaveDate.single;
        leaveData.leave_from = formData.leaveDate.single;
        leaveData.leave_to = formData.leaveDate.single;
      } else {
        leaveData.leave_from = formData.leaveDate.from;
        leaveData.leave_to = formData.leaveDate.to;
        // Keep leave_date for single-day ranges (from === to)
        if (formData.leaveDate.from === formData.leaveDate.to) {
          leaveData.leave_date = formData.leaveDate.from;
        }
      }

      try {
        const created = await createLeave(leaveData);

        if (created?.combined_balance && Array.isArray(created?.split)) {
          const splitHtml = created.split
            .map(
              (part) =>
                `<li><b>${part.days}</b> day(s) from <b>${part.leave_type}</b></li>`
            )
            .join("");
          Swal.fire({
            icon: "success",
            title: "Leave submitted (combined balances)",
            html: `
              <div class="text-left text-sm">
                <p>Leave was split across Annual and Casual balances:</p>
                <ul class="list-disc pl-5 mt-2">${splitHtml}</ul>
              </div>
            `,
            confirmButtonColor: "#3085d6",
          });
        } else {
          const nopayPreview = Number(created?.nopay_preview_days ?? created?.nopay_days ?? 0);
          if (nopayPreview > 0) {
            Swal.fire({
              icon: "success",
              title: "Leave submitted",
              html: `
                <div class="text-left text-sm">
                  <p>Leave request submitted successfully.</p>
                  <p class="mt-2">Estimated shortfall: <b>${nopayPreview}</b> day(s) will become <b>NoPay</b> when HR approves.</p>
                </div>
              `,
              confirmButtonColor: "#3085d6",
            });
          } else {
            Swal.fire({
              icon: "success",
              title: "Success",
              text: "Leave request submitted successfully!",
              confirmButtonColor: "#3085d6",
            });
          }
        }

        await handleSubmitSuccess();
      } catch (error) {
        // Soft allow path: backend may still return soft entitlement warnings only if old code
        if (
          error.response?.status === 422 &&
          error.response?.data?.continue_allowed === true &&
          (error.response?.data?.entitlement_exceeded || error.response?.data?.limit_exceeded)
        ) {
          const data = error.response.data;
          const nopayPreview = Number(data.nopay_preview_days ?? 0);
          const retry = await Swal.fire({
            icon: "warning",
            title: "Insufficient leave balance",
            html: `
              <div class="text-left text-sm">
                <p>${data.message || ""}</p>
                <p class="mt-2"><b>Reason:</b> ${data.reason || ""}</p>
                ${data.available_days != null ? `<p class="mt-2">Available: <b>${data.available_days}</b> day(s)</p>` : ""}
                ${nopayPreview > 0 ? `<p>NoPay on HR approve: <b>${nopayPreview}</b> day(s)</p>` : ""}
              </div>
            `,
            showCancelButton: true,
            confirmButtonText: "Submit anyway",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#c2410c",
          });
          if (retry.isConfirmed) {
            try {
              const leaveDataRetry = { ...leaveData, force_continue: true };
              const createdRetry = await createLeave(leaveDataRetry);
              Swal.fire({
                icon: "success",
                title: "Leave submitted",
                text: createdRetry?.message || "Leave request submitted successfully!",
                confirmButtonColor: "#3085d6",
              });
              await handleSubmitSuccess();
            } catch (retryErr) {
              Swal.fire({
                icon: "error",
                title: "Error",
                text: retryErr.response?.data?.message || "Failed to submit leave request",
                confirmButtonColor: "#3085d6",
              });
            }
          }
          setIsSubmitting(false);
          return;
        }

        if (
          error.response?.status === 422 &&
          (error.response?.data?.entitlement_exceeded ||
            (error.response?.data?.limit_exceeded && error.response?.data?.continue_allowed === false))
        ) {
          const data = error.response.data;
          Swal.fire({
            icon: "error",
            title: "Cannot Apply Leave",
            html: `
              <div class="text-left">
                <p>${data.message || ""}</p>
                <p class="mt-3"><b>Reason:</b> ${data.reason || data.message || "Leave entitlement exceeded."}</p>
              </div>
            `,
            confirmButtonColor: "#3085d6",
            confirmButtonText: "OK",
          });
          setIsSubmitting(false);
          return;
        }

        // Check if this is a limit exceeded error that allows continuation
        if (
          error.response?.status === 422 &&
          error.response?.data?.limit_exceeded &&
          error.response?.data?.continue_allowed
        ) {
          // Show warning with continue option
          const result = await Swal.fire({
            icon: "warning",
            title: "Leave Limitation",
            html: `
              <div class="text-left">
                <p>${error.response.data.message}</p>
                <p class="mt-3">Do you want to continue with this request anyway?</p>
                <p class="mt-2 text-xs text-gray-500">
                  Note: Continuing will mark this leave with an override status
                </p>
              </div>
            `,
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Continue Anyway",
            cancelButtonText: "Cancel Request",
          });

          if (result.isConfirmed) {
            // User wants to continue - resubmit with force_continue flag
            leaveData.force_continue = true; // අලුතින් force continue එකතු කළා
            try {
              await createLeaveWithOverride(leaveData);

              Swal.fire({
                icon: "success",
                title: "Leave Request Submitted",
                text: "Your leave request has been submitted with the noted limitation.",
                confirmButtonColor: "#3085d6",
              });

              await handleSubmitSuccess();
            } catch (innerError) {
              handleSubmitError(innerError);
            }
          } else {
            // User canceled the request
            setIsSubmitting(false);
          }
          return;
        }

        // Handle other errors
        handleSubmitError(error);
      }
    } catch (error) {
      handleSubmitError(error);
    }
  };





  // Add these helper functions for cleaner code
  const handleSubmitSuccess = async () => {
    // Refresh the leave data to show updated balance
    await Promise.all([
      fetchEmployeeLeaves(employeeData.id, employeeData),
      fetchLeaveUsage(employeeData.attendance_employee_no || formData.attendanceNo),
    ]);

    // Dispatch event to notify calendar to refresh
    window.dispatchEvent(new Event('leaveSubmitted'));

    setSubmitSuccess(true);
    setFormData({
      ...formData,
      reportingDate: getCurrentDate(),
      leaveType: "",
      dateSelection: "single",
      leaveDateType: "fullDay",
      halfDayPeriod: "morning",
      shortLeaveSlot: "slot1",
      leaveDate: {
        single: getCurrentDate(),
        from: getCurrentDate(),
        to: getCurrentDate(),
      },
      reason: "",
      covering_employee_id: "",
    });

    setIsSubmitting(false);
  };

  const handleSubmitError = (error) => {
    console.error("Error submitting leave request:", error);

    // Check for duplicate error
    if (error.response?.status === 422 && error.response?.data?.duplicate_found) {
      Swal.fire({
        icon: "error",
        title: "Duplicate Leave Request",
        text: error.response.data.message,
        confirmButtonColor: "#3085d6",
      });
      setIsSubmitting(false);
      return;
    }

    // Entitlement / Act block from backend
    if (
      error.response?.status === 422 &&
      (error.response?.data?.entitlement_exceeded ||
        (error.response?.data?.limit_exceeded && error.response?.data?.continue_allowed === false))
    ) {
      const data = error.response.data;
      Swal.fire({
        icon: "error",
        title: "Cannot Apply Leave",
        html: `
          <div class="text-left">
            <p class="text-red-600 font-bold mb-2">You cannot get this leave.</p>
            <p>${data.message || ""}</p>
            <p class="mt-3"><b>Reason:</b> ${data.reason || data.message || "Leave entitlement exceeded."}</p>
            ${data.law_reference ? `<p class="mt-2 text-xs text-gray-500">${data.law_reference}</p>` : ""}
          </div>
        `,
        confirmButtonColor: "#3085d6",
      });
      setIsSubmitting(false);
      return;
    }

    // Check if the error response contains validation errors
    if (
      error.response?.status === 422 &&
      !error.response?.data?.limit_exceeded
    ) {
      showValidationErrors(error.response.data);
    } else if (error.response?.data?.message) {
      // Show specific error message from the server
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response.data.message,
        confirmButtonColor: "#3085d6",
      });
    } else {
      // Show generic error message
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to submit leave request. Please try again.",
        confirmButtonColor: "#3085d6",
      });
    }

    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 py-4 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4 max-w-7xl">

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-4 sm:px-8 py-6 sm:py-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white text-center">
              Leave Master
            </h1>
            <p className="text-blue-100 text-center mt-2 text-sm sm:text-base">
              Employee Leave Management System{" "}
              {formData.attendanceNo && `- EMP No: ${formData.attendanceNo}`}
            </p>
          </div>
          <div className="p-4 sm:p-6 lg:p-8">
            {submitSuccess && (
              <div className="mb-6 bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  <span>Leave request submitted successfully!</span>
                </div>
                <button
                  onClick={() => setSubmitSuccess(false)}
                  className="text-green-700 hover:text-green-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {submitError && (
              <div className="mb-6 bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
                <div className="flex items-center">
                  <X className="w-5 h-5 mr-2" />
                  <span>{submitError}</span>
                </div>
                <button
                  onClick={() => setSubmitError("")}
                  className="text-red-700 hover:text-red-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          EMP number <span className="text-red-500">*</span>
                        </label>
                        <div className="flex">
                          <input
                            type="text"
                            name="attendanceNo"
                            value={formData.attendanceNo}
                            onChange={handleDateChange}
                            required
                            disabled={!!employeeProfile}
                            className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${employeeProfile ? 'bg-gray-50 text-gray-500' : ''
                              }`}
                            placeholder="Enter employee number"
                          />
                          {!employeeProfile && (
                            <button
                              type="button"
                              className="ml-2 p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                              onClick={fetchEmployeeDetails}
                              disabled={isLoading}
                            >
                              {isLoading ? (
                                <div className="w-5 h-5 border-t-2 border-b-2 border-blue-600 rounded-full animate-spin"></div>
                              ) : (
                                <Search className="w-5 h-5" />
                              )}
                            </button>
                          )}
                        </div>
                        {searchError && (
                          <p className="text-xs text-red-500 mt-1">
                            {searchError}
                          </p>
                        )}
                        {employeeProfile && (
                          <p className="text-xs text-green-600 mt-1">
                            ✓ Logged in as {formData.employeeName}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          EPF No
                        </label>
                        <input
                          type="text"
                          name="epfNo"
                          value={formData.epfNo}
                          disabled
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="EPF number"
                        />
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Employee Name
                        </label>
                        <input
                          type="text"
                          name="employeeName"
                          value={formData.employeeName}
                          disabled
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="Employee name"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Department
                        </label>
                        <input
                          type="text"
                          name="department"
                          value={formData.department}
                          disabled
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="Department"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Reporting Date
                        </label>
                        <DatePickerInput
                          name="reportingDate"
                          value={formData.reportingDate}
                          disabled
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Leave Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="leaveType"
                          value={formData.leaveType}
                          onChange={handleDateChange}
                          required
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                          disabled={leaveUsageData.length === 0}
                        >
                          <option value="">Select Leave Type</option>
                          {leaveUsageData.map((item) => (
                            <option key={item.leaveType} value={item.leaveType}>
                              {item.leaveType} (Available: {item.balance})
                            </option>
                          ))}
                        </select>
                        {leaveUsageData.length === 0 && formData.employeeName && (
                          <p className="text-xs text-gray-500 mt-1">
                            No leave types available for this employee
                          </p>
                        )}
                      </div>
                    </div>


                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date selection <span className="text-red-500">*</span>
                      </label>
                      <div className="flex flex-wrap gap-4 mb-4">
                        <div className="flex items-center">
                          <input
                            type="radio"
                            id="dateSingle"
                            name="dateSelection"
                            value="single"
                            checked={formData.dateSelection === "single"}
                            onChange={handleDateChange}
                            className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500"
                          />
                          <label htmlFor="dateSingle" className="text-sm text-gray-700">
                            Single Date
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="radio"
                            id="dateRange"
                            name="dateSelection"
                            value="range"
                            checked={formData.dateSelection === "range"}
                            onChange={handleDateChange}
                            className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500"
                          />
                          <label htmlFor="dateRange" className="text-sm text-gray-700">
                            Date Range
                          </label>
                        </div>
                      </div>

                      {formData.dateSelection === "single" && (
                        <div className="mb-4 relative">
                          <label className="block text-xs text-gray-500 mb-1">Date</label>
                          <div
                            className="relative"
                            onMouseEnter={() => setHoveredDate(formData.leaveDate.single)}
                            onMouseLeave={() => setHoveredDate(null)}
                          >
                            <input
                              type="date"
                              name="leaveDate.single"
                              value={formData.leaveDate.single}
                              onChange={handleDateChange}
                              required
                              className={getDateInputStyle(formData.leaveDate.single)}
                              min={getMinLeaveDate()}
                              onKeyDown={(e) => e.preventDefault()}
                            />
                            {hoveredDate === formData.leaveDate.single &&
                              getDateHoverContent(formData.leaveDate.single)}
                          </div>
                          {isDateDisabled(formData.leaveDate.single) && (
                            <p className="mt-1 text-xs text-red-600 flex items-center">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              This date is unavailable for leave
                            </p>
                          )}
                        </div>
                      )}

                      {formData.dateSelection === "range" && (
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="relative">
                            <label className="block text-xs text-gray-500 mb-1">From</label>
                            <div
                              className="relative"
                              onMouseEnter={() => setHoveredDate(formData.leaveDate.from)}
                              onMouseLeave={() => setHoveredDate(null)}
                            >
                              <input
                                type="date"
                                name="leaveDate.from"
                                value={formData.leaveDate.from}
                                onChange={handleDateChange}
                                required
                                className={getDateInputStyle(formData.leaveDate.from)}
                                min={getMinLeaveDate()}
                                onKeyDown={(e) => e.preventDefault()}
                              />
                              {hoveredDate === formData.leaveDate.from &&
                                getDateHoverContent(formData.leaveDate.from)}
                            </div>
                            {isDateDisabled(formData.leaveDate.from) && (
                              <p className="mt-1 text-xs text-red-600 flex items-center">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                This date is unavailable for leave
                              </p>
                            )}
                          </div>
                          <div className="relative">
                            <label className="block text-xs text-gray-500 mb-1">To</label>
                            <div
                              className="relative"
                              onMouseEnter={() => setHoveredDate(formData.leaveDate.to)}
                              onMouseLeave={() => setHoveredDate(null)}
                            >
                              <input
                                type="date"
                                name="leaveDate.to"
                                value={formData.leaveDate.to}
                                onChange={handleDateChange}
                                required
                                className={getDateInputStyle(formData.leaveDate.to)}
                                min={formData.leaveDate.from}
                                onKeyDown={(e) => e.preventDefault()}
                              />
                              {hoveredDate === formData.leaveDate.to &&
                                getDateHoverContent(formData.leaveDate.to)}
                            </div>
                            {isDateDisabled(formData.leaveDate.to) && (
                              <p className="mt-1 text-xs text-red-600 flex items-center">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                This date is unavailable for leave
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Day type <span className="text-red-500">*</span>
                      </label>
                      <div className="flex flex-wrap gap-4 mb-4">
                        <div className="flex items-center">
                          <input
                            type="radio"
                            id="fullDay"
                            name="leaveDateType"
                            value="fullDay"
                            checked={formData.leaveDateType === "fullDay"}
                            onChange={handleDateChange}
                            className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500"
                          />
                          <label htmlFor="fullDay" className="text-sm text-gray-700">
                            Full Day
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="radio"
                            id="halfDay"
                            name="leaveDateType"
                            value="halfDay"
                            checked={formData.leaveDateType === "halfDay"}
                            onChange={handleDateChange}
                            className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500"
                          />
                          <label htmlFor="halfDay" className="text-sm text-gray-700">
                            Half Day
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="radio"
                            id="shortLeave"
                            name="leaveDateType"
                            value="shortLeave"
                            checked={formData.leaveDateType === "shortLeave"}
                            onChange={handleDateChange}
                            className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500"
                          />
                          <label htmlFor="shortLeave" className="text-sm text-gray-700">
                            Short Leave
                          </label>
                        </div>
                      </div>

                      {formData.leaveDateType === "halfDay" && (
                        <div className="mb-4">
                          <label className="block text-xs text-gray-500 mb-1">Period (each day)</label>
                          <select
                            name="halfDayPeriod"
                            value={formData.halfDayPeriod}
                            onChange={handleDateChange}
                            required
                            className="w-full sm:w-1/2 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          >
                            <option value="morning">Morning</option>
                            <option value="afternoon">Afternoon</option>
                          </select>
                        </div>
                      )}

                      {formData.leaveDateType === "shortLeave" && (
                        <div className="mb-4">
                          <label className="block text-xs text-gray-500 mb-1">Time Slot (2 hours, each day)</label>
                          <select
                            name="shortLeaveSlot"
                            value={formData.shortLeaveSlot}
                            onChange={handleDateChange}
                            required
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          >
                            <option value="slot1">8:30 AM - 10:30 AM</option>
                            <option value="slot2">10:30 AM - 12:30 PM</option>
                            <option value="slot3">1:30 PM - 3:30 PM</option>
                            <option value="slot4">3:30 PM - 5:30 PM</option>
                          </select>
                        </div>
                      )}

                      <div className="mb-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                        <span className="font-medium">Leave calculation: </span>
                        {getLeaveCalendarDays()} calendar day(s) × {getLeaveUnitLabel()} ={" "}
                        <span className="font-bold">{getRequestedLeaveDuration()}</span> day(s)
                      </div>
                    </div>


                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Covering person <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={coveringFilter}
                        onChange={(e) => setCoveringFilter(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 mb-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Search name or attendance number"
                      />
                      <select
                        name="covering_employee_id"
                        value={formData.covering_employee_id}
                        onChange={handleDateChange}
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      >
                        <option value="">Select covering person</option>
                        {(coveringFilter.trim()
                          ? coveringColleagues.filter((c) => {
                              const n = `${c.full_name || ""} ${c.name_with_initials || ""} ${c.attendance_employee_no || ""}`.toLowerCase();
                              return n.includes(coveringFilter.trim().toLowerCase());
                            })
                          : coveringColleagues
                        ).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.full_name || c.name_with_initials} {c.attendance_employee_no ? `(${c.attendance_employee_no})` : ""}
                          </option>
                        ))}
                      </select>
                      {!coveringColleagues.length && (
                        <p className="mt-1 text-xs text-amber-700">
                          No covering-person list yet. Search an employee first, or ask HR to add colleagues in this company.
                        </p>
                      )}
                    </div>

                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reason
                      </label>
                      <textarea
                        name="reason"
                        value={formData.reason}
                        onChange={handleDateChange}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="Reason for leave"
                      ></textarea>
                    </div>

                    <div className="mt-4 text-xs text-gray-500">
                      <p>
                        Marked with <span className="text-red-500">*</span> are
                        required
                      </p>
                    </div>
                  </div>


                  <div className="mt-6 flex justify-end space-x-4">
                    <button
                      type="button"
                      className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                      onClick={() => {
                        setFormData({
                          attendanceNo: "",
                          epfNo: "",
                          employeeName: "",
                          department: "",
                          reportingDate: getCurrentDate(),
                          leaveType: "",
                          dateSelection: "single",
                          leaveDateType: "fullDay",
                          halfDayPeriod: "morning",
                          shortLeaveSlot: "slot1",
                          leaveDate: {
                            single: getCurrentDate(),
                            from: getCurrentDate(),
                            to: getCurrentDate(),
                          },
                          reason: "",
                        });
                        setSearchError("");
                        setSubmitError("");
                        setSubmitSuccess(false);
                        setLeaveRecords([]);
                      }}
                      disabled={isSubmitting}
                    >
                      Clear Form
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 transition-colors shadow-md hover:shadow-lg flex items-center justify-center min-w-[150px]"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin mr-2"></div>
                          <span>Submitting...</span>
                        </>
                      ) : (
                        "Submit Leave Request"
                      )}
                    </button>
                  </div>
                </div>


                <div className="space-y-6">

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-medium text-gray-800">
                        Leave Usage Summary
                      </h3>
                      {formData.employeeName && (
                        <span className="text-sm text-gray-600">
                          {formData.employeeName}
                        </span>
                      )}
                    </div>
                    {leaveLawInfo && (
                      <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                        <p className="font-medium">{leaveLawInfo.lawReference}</p>
                        <p className="mt-1 text-blue-800">
                          {leaveLawInfo.balanceSource === "employee_leave_balances"
                            ? "Balances use HR employee override for this year (manual)."
                            : leaveLawInfo.balanceSource === "manual_only_until_act_start"
                              ? `Act earning leave starts from ${leaveLawInfo.actAccrualStartsOn}. Until then, only HR-entered balances apply.`
                              : "Entitlements calculated under Shop & Office Act (Annual + Casual)."}
                          {leaveLawInfo.employmentYear
                            ? ` Employment year: ${leaveLawInfo.employmentYear}.`
                            : ""}
                          {leaveLawInfo.calendarYear
                            ? ` Calendar year: ${leaveLawInfo.calendarYear}.`
                            : ""}
                        </p>
                        {leaveLawInfo.message ? (
                          <p className="mt-1 text-amber-800">{leaveLawInfo.message}</p>
                        ) : null}
                        <ul className="mt-2 list-disc pl-4 text-blue-800 space-y-0.5">
                          <li>Leave can be submitted even if balance is short; shortfall becomes NoPay on HR approve.</li>
                          <li>Act auto earning: from {leaveLawInfo.actAccrualStartsOn || "2026-12-31"} onward</li>
                          <li>1st year: no Annual; Casual = 0.5/month from month after join (hire month ignored)</li>
                          <li>2nd year: Annual 14/10/7/4 by join quarter; Casual = 0.5/month from month after join</li>
                          <li>3rd year+: Annual 14; Casual 7</li>
                        </ul>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      {isLoadingUsage ? (
                        <div className="py-10 text-center">
                          <div className="inline-block w-6 h-6 border-t-2 border-b-2 border-blue-600 rounded-full animate-spin"></div>
                          <p className="mt-2 text-sm text-gray-600">
                            Loading leave usage data...
                          </p>
                        </div>
                      ) : (
                        <table className="min-w-full bg-white border-collapse">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                #
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Leave Type
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Total
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Usage
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Balance
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Act Note
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {leaveUsageData.map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 border text-sm">
                                  {item.id}
                                </td>
                                <td className="px-4 py-3 border text-sm">
                                  {item.leaveType}
                                </td>
                                <td className="px-4 py-3 border text-sm">
                                  {item.total}
                                </td>
                                <td className="px-4 py-3 border text-sm">
                                  {item.usage}
                                </td>
                                <td className="px-4 py-3 border text-sm font-medium text-blue-600">
                                  {item.balance}
                                </td>
                                <td className="px-4 py-3 border text-xs text-gray-600 max-w-[220px]">
                                  {item.note || "—"}
                                </td>
                              </tr>
                            ))}
                            {leaveUsageData.length === 0 && !isLoadingUsage && (
                              <tr>
                                <td
                                  colSpan="6"
                                  className="px-4 py-8 border text-center text-gray-500"
                                >
                                  {formData.employeeName
                                    ? "No leave usage data available for this employee"
                                    : "Search for an employee to view leave balances"}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>


                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-medium text-gray-800">
                        Employee Leave Record
                      </h3>
                      {formData.employeeName && (
                        <span className="text-sm text-gray-600">
                          {formData.employeeName}
                        </span>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      {isLoadingLeaves ? (
                        <div className="py-10 text-center">
                          <div className="inline-block w-6 h-6 border-t-2 border-b-2 border-blue-600 rounded-full animate-spin"></div>
                          <p className="mt-2 text-sm text-gray-600">
                            Loading leave records...
                          </p>
                        </div>
                      ) : (
                        <table className="min-w-full bg-white border-collapse">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                #
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Leave Date
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Duration
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Report Date
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Type
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Leave Type
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Status
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                NoPay
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {leaveRecords.map((record) => (
                              <tr key={record.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 border text-sm">
                                  {record.id}
                                </td>
                                <td className="px-4 py-3 border text-sm">
                                  {record.leaveDate}
                                </td>
                                <td className="px-4 py-3 border text-sm">
                                  {record.duration} days
                                  {record.requestedDays != null &&
                                    Number(record.requestedDays) !== Number(record.duration) ? (
                                    <span className="block text-xs text-gray-500">
                                      Requested: {record.requestedDays}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-4 py-3 border text-sm">
                                  {record.reportDate}
                                </td>
                                <td className="px-4 py-3 border text-sm">
                                  {record.fullHalfDay}
                                </td>
                                <td className="px-4 py-3 border text-sm">
                                  {record.leaveType}
                                </td>
                                <td className="px-4 py-3 border text-sm">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${record.status === "Approved" || record.status === "HR_Approved"
                                      ? "bg-green-100 text-green-800"
                                      : record.status === "Rejected"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-yellow-100 text-yellow-800"
                                      }`}
                                  >
                                    {record.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 border text-sm">
                                  {record.hasOverLimit || record.nopayDays > 0 ? (
                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                      {record.nopayApplied ? "NoPay applied: " : "NoPay (pending approve): "}
                                      {record.nopayDays || record.overLimit} day(s)
                                    </span>
                                  ) : (
                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      No NoPay
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {leaveRecords.length === 0 && !isLoadingLeaves && (
                              <tr>
                                <td
                                  colSpan="8"
                                  className="px-4 py-8 border text-center text-gray-500"
                                >
                                  {formData.employeeName
                                    ? "No leave records found for this employee"
                                    : "Search for an employee to view their leave records"}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveMaster;






/*

import React, { useState, useEffect } from "react";
import {
  Calendar,
  User,
  Briefcase,
  Clock,
  CheckCircle,
  Search,
  Building,
  FileText,
  X,
  AlertCircle,
} from "lucide-react";
import Swal from "sweetalert2";
import employeeService from "../../services/EmployeeDataService";
import {
  createLeave,
  createLeaveWithOverride, // Add this import
  getLeaveById,
  getLeaveEligibility,
} from "../../services/LeaveMaster";
import { fetchLeaveCalendar } from "../../services/LeaveCalendar";

const LeaveMaster = ({ employeeProfile }) => {
  // State for form fields
  const [formData, setFormData] = useState({
    emp_id: "",
    attendanceNo: "",
    epfNo: "",
    employeeName: "",
    department: "",
    reportingDate: getCurrentDate(),
    leaveType: "",
    leaveDateType: "fullDay",
    halfDayPeriod: "morning",
    shortLeaveSlot: "slot1",
    leaveDate: {
      single: getCurrentDate(),
      from: getCurrentDate(),
      to: getCurrentDate(),
    },
    reason: "",
    covering_employee_id: "",
  });

  // Loading and notification states
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [isLoadingLeaves, setIsLoadingLeaves] = useState(false);
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [leaveUsageData, setLeaveUsageData] = useState([]);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const [disabledDates, setDisabledDates] = useState([]);
  const [hoveredDate, setHoveredDate] = useState(null);

  // Add a new state to store employee data
  const [employeeData, setEmployeeData] = useState(null);
  const [coveringColleagues, setCoveringColleagues] = useState([]);
  const [coveringFilter, setCoveringFilter] = useState("");

  // Auto-fill logged-in employee details
  useEffect(() => {
    if (employeeProfile) {
      setEmployeeData(employeeProfile);
      setFormData(prev => ({
        ...prev,
        emp_id: employeeProfile.id || "",
        attendanceNo: employeeProfile.attendance_employee_no || "",
        epfNo: employeeProfile.epf || "",
        employeeName: employeeProfile.name_with_initials || "",
        department: employeeProfile.organization_assignment?.department?.name || "",
      }));
      
      // Fetch leave data for logged-in employee
      if (employeeProfile.id) {
        fetchEmployeeLeaves(employeeProfile.id, employeeProfile);
        fetchLeaveUsage(employeeProfile.attendance_employee_no);
      }
    }
  }, [employeeProfile]);



  // Helper function to get current date in YYYY-MM-DD format
  function getCurrentDate() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Earliest leave date allowed on the form (backdating from April 1 of this year)
  function getMinLeaveDate() {
    const year = new Date().getFullYear();
    return `${year}-04-01`;
  }

  // Function to format date for display
  function formatDate(dateInput) {
    if (!dateInput) return "";
    const date =
      typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    return date.toISOString().split("T")[0];
  }

  // Function to format leave record for display
  function formatLeaveRecord(leaveData) {
    let leaveDateDisplay = "";

    if (leaveData.leave_date) {
      leaveDateDisplay = formatDate(leaveData.leave_date);
      if (leaveData.period) {
        leaveDateDisplay += ` (${leaveData.period})`;
      }
    } else if (leaveData.leave_from && leaveData.leave_to) {
      leaveDateDisplay = `${formatDate(leaveData.leave_from)} to ${formatDate(
        leaveData.leave_to
      )}`;
      if (leaveData.leave_duration > 1) {
        leaveDateDisplay += ` (${leaveData.leave_duration} days)`;
      }
    }

    // Check for over-limit leave
    const hasOverLimit = leaveData.over_limit && leaveData.over_limit > 0;

    return {
      id: leaveData.id,
      leaveDate: leaveDateDisplay,
      reportDate: formatDate(leaveData.reporting_date),
      fullHalfDay: leaveData.is_half_day
        ? "Half Day"
        : leaveData.leave_duration > 1
        ? "Multiple Days"
        : "Full Day",
      leaveType: leaveData.leave_type,
      status: leaveData.status,
      duration: leaveData.leave_duration || (leaveData.is_half_day ? 0.5 : 1),
      hasOverLimit: hasOverLimit,
      overLimit: hasOverLimit ? leaveData.over_limit : 0,
    };
  }

  // Update the getDisabledDates function to check company ID
  const getDisabledDates = (calendarData, employeeCompanyId) => {
    const dates = [];

    if (!employeeCompanyId) return dates;

    calendarData.forEach((leave) => {
      // Only process leaves that match the employee's company
      if (leave.company_id === employeeCompanyId && leave.start_date) {
        const start = new Date(leave.start_date);
        const end = leave.end_date
          ? new Date(leave.end_date)
          : new Date(leave.start_date);
        for (
          let date = new Date(start);
          date <= end;
          date.setDate(date.getDate() + 1)
        ) {
          dates.push(formatDate(new Date(date)));
        }
      }
    });
    return dates;
  };

  // Enhanced date input handler with validation
  const handleDateChange = (e) => {
    const { name, value } = e.target;

    // Check if this is a date field
    if (name.includes("leaveDate")) {
      // Check if the selected date is disabled
      if (disabledDates.includes(value)) {
        // Show error message
        Swal.fire({
          icon: "error",
          title: "Date Not Available",
          html: `
            <div class="text-left">
              <p>This date (${formatDateForDisplay(
                value
              )}) is not available for leave requests because:</p>
              <ul class="list-disc pl-5 mt-2">
                <li>It's marked as an event day</li>
                <li>Or it's already booked as leave</li>
              </ul>
              <p class="mt-3 text-sm">Please select a different date.</p>
            </div>
          `,
          confirmButtonColor: "#3085d6",
          confirmButtonText: "Ok, I understand",
          customClass: {
            popup: "rounded-xl",
            confirmButton: "rounded-lg text-sm px-5 py-2.5",
          },
        });
        return; // Don't update the state
      }
    }

    // Handle nested objects in state (like leaveDate.single, leaveDate.from, etc.)
    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setFormData({
        ...formData,
        [parent]: {
          ...formData[parent],
          [child]: value,
        },
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  // Format date for display in error messages
  const formatDateForDisplay = (dateString) => {
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Function to check if a date is disabled
  const isDateDisabled = (dateString) => {
    return disabledDates.includes(dateString);
  };

  // Function to get date input styling based on disabled status
  const getDateInputStyle = (dateString) => {
    const baseStyle =
      "w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200";

    if (isDateDisabled(dateString)) {
      return `${baseStyle} bg-red-50 border-red-300 text-red-700 cursor-not-allowed`;
    }

    return `${baseStyle} border-gray-300`;
  };

  // Function to get date hover tooltip content
  const getDateHoverContent = (dateString) => {
    if (!isDateDisabled(dateString)) return null;

    return (
      <div className="absolute z-10 bottom-full mb-2 left-0 bg-red-600 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
        <AlertCircle className="inline mr-1 w-3 h-3" />
        Unavailable date (event or existing leave)
      </div>
    );
  };

  // Function to fetch employee leaves and calendar data (to set disabled dates)
  const fetchEmployeeLeaves = async (employeeId, empData) => {
    if (!employeeId) return;

    setIsLoadingLeaves(true);
    try {
      const [leaveData, calendarData] = await Promise.all([
        getLeaveById(employeeId),
        fetchLeaveCalendar(),
      ]);

      // Get employee's company ID from organization assignment
      const employeeCompanyId = empData?.organization_assignment?.company?.id;

      // Set disabled dates only for matching company
      const disabledDatesArray = getDisabledDates(
        calendarData,
        employeeCompanyId
      );
      setDisabledDates(disabledDatesArray);

      if (leaveData && Array.isArray(leaveData)) {
        const formattedLeaves = leaveData.map(formatLeaveRecord);
        setLeaveRecords(formattedLeaves);
      } else {
        setLeaveRecords([]);
      }
    } catch (error) {
      console.error("Error fetching employee leaves:", error);
      Swal.fire({
        icon: "error",
        title: "Data Fetch Error",
        text: "Failed to fetch leave records. Please try again.",
        confirmButtonColor: "#3085d6",
      });
      setLeaveRecords([]);
    } finally {
      setIsLoadingLeaves(false);
    }
  };

  // Function to fetch employee leave eligibility - uses dynamic leave types from API
  const fetchLeaveUsage = async (empNumber) => {
    if (!empNumber) return;

    setIsLoadingUsage(true);
    try {


      
      const eligibilityData = await getLeaveEligibility(empNumber);
      
      console.log("empNumber sent:", empNumber);
console.log("eligibilityData:", eligibilityData);
console.log("eligible_leaves:", eligibilityData?.eligible_leaves);

      if (eligibilityData && eligibilityData.eligible_leaves && Array.isArray(eligibilityData.eligible_leaves)) {
        const formattedUsage = eligibilityData.eligible_leaves.map(
          (leave, index) => ({
            id: index + 1,
            leaveType: leave.leave_type,
            total: leave.total_days,
            usage: leave.used_days.toFixed(1),
            balance: leave.available_days.toFixed(1),
            isHalfDayOnly: leave.is_half_day_only,
            note: leave.note,
          })
        );
        setLeaveUsageData(formattedUsage);
        
        // Show message if no leave settings configured
        if (formattedUsage.length === 0 && eligibilityData.message) {
          Swal.fire({
            icon: "info",
            title: "Leave Settings",
            text: eligibilityData.message,
            confirmButtonColor: "#3085d6",
          });
        }
      } else {
        // Clear data if no eligible leaves found
        setLeaveUsageData([]);
      }
    } catch (error) {
      console.error("Error fetching leave eligibility data:", error);
      Swal.fire({
        icon: "error",
        title: "Data Fetch Error",
        text: "Failed to fetch leave eligibility data. Please try again.",
        confirmButtonColor: "#3085d6",
      });
      setLeaveUsageData([]);
    } finally {
      setIsLoadingUsage(false);
    }
  };

  // Function to fetch employee details using the API
  const fetchEmployeeDetails = async () => {
    if (!formData.attendanceNo) {
      Swal.fire({
        icon: "error",
        title: "Input Required",
        text: "Please enter an employee number",
        confirmButtonColor: "#3085d6",
      });
      return;
    }

    setIsLoading(true);
    setSearchError("");

    try {
      const empData = await employeeService.searchByAttendanceNo(
        formData.attendanceNo
      );

      if (empData) {
        // Store the full employee data
        setEmployeeData(empData);

        setFormData({
          ...formData,
          emp_id: empData.id || "",
          epfNo: empData.epf || "",
          employeeName: empData.name_with_initials || "",
          department: empData.organization_assignment?.department?.name || "",
        });

        await Promise.all([
          fetchEmployeeLeaves(empData.id, empData),
          fetchLeaveUsage(empData.attendance_employee_no || formData.attendanceNo),
        ]);
      } else {
        Swal.fire({
          icon: "error",
          title: "Employee Not Found",
          text: "No employee found with the provided number",
          confirmButtonColor: "#3085d6",
        });
        setLeaveRecords([]);
        setEmployeeData(null);
        setLeaveUsageData([]);
      }
    } catch (error) {
      console.error("Error fetching employee data:", error);

      if (error.response?.data?.message) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.response.data.message,
          confirmButtonColor: "#3085d6",
        });
      } else if (error.response?.data) {
        showValidationErrors(error.response.data);
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to retrieve employee data. Please try again.",
          confirmButtonColor: "#3085d6",
        });
      }
      setLeaveRecords([]);
      setEmployeeData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Add this function at the top level of your component
  const showValidationErrors = (errors) => {
    const list = [];
    const walk = (value) => {
      if (value == null || value === "") return;
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (typeof value === "object") {
        Object.entries(value).forEach(([key, item]) => {
          if (["trace", "exception", "file", "line"].includes(key)) return;
          walk(item);
        });
        return;
      }
      const text = String(value);
      if (text && text !== "undefined") list.push(text);
    };
    walk(errors);
    const errorList = list.map((error) => `<li class="text-left">${error}</li>`).join("");

    Swal.fire({
      icon: "error",
      title: "Cannot submit leave",
      html: `
        <div>
          <ul class="list-disc pl-4 mt-2">
            ${errorList || "<li>Please check the form and try again.</li>"}
          </ul>
        </div>
      `,
      confirmButtonColor: "#3085d6",
      customClass: {
        container: "font-sans",
        popup: "rounded-xl",
        confirmButton: "rounded-lg text-sm px-5 py-2.5",
      },
    });
  };

  // Handle form submission for leave requests - modified to validate leave balance
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess(false);
    setIsSubmitting(true);

    // If all main identifying fields are empty, show same error as for missing employee number
    const allEmpty =
      !formData.attendanceNo &&
      !formData.epfNo &&
      !formData.employeeName &&
      !formData.department;

    if (allEmpty) {
      Swal.fire({
        icon: "error",
        title: "Input Required",
        text: "Please enter an employee number",
        confirmButtonColor: "#3085d6",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // First validate all selected dates
      let invalidDates = [];

      if (formData.leaveDateType === "fullDay") {
        if (isDateDisabled(formData.leaveDate.single)) {
          invalidDates.push(formData.leaveDate.single);
        }
      } else if (formData.leaveDateType === "halfDay") {
        if (isDateDisabled(formData.leaveDate.single)) {
          invalidDates.push(formData.leaveDate.single);
        }
      } else if (formData.leaveDateType === "manual") {
        // Check each date in the range
        const fromDate = new Date(formData.leaveDate.from);
        const toDate = new Date(formData.leaveDate.to);

        // Validate date range (to date should be after or equal to from date)
        if (toDate < fromDate) {
          Swal.fire({
            icon: "error",
            title: "Invalid Date Range",
            text: "End date cannot be before start date",
            confirmButtonColor: "#3085d6",
          });
          setIsSubmitting(false);
          return;
        }

        for (
          let d = new Date(fromDate);
          d <= toDate;
          d.setDate(d.getDate() + 1)
        ) {
          const dateStr = formatDate(d);
          if (isDateDisabled(dateStr)) {
            invalidDates.push(dateStr);
          }
        }
      }

      if (invalidDates.length > 0) {
        Swal.fire({
          icon: "error",
          title: "Invalid Date Selection",
          html: `
          <div class="text-left">
            <p>The following selected dates are not available:</p>
            <ul class="list-disc pl-5 mt-2">
              ${invalidDates
                .map((d) => `<li>${formatDateForDisplay(d)}</li>`)
                .join("")}
            </ul>
            <p class="mt-3 text-sm">Please adjust your leave dates and try again.</p>
          </div>
        `,
          confirmButtonColor: "#3085d6",
          confirmButtonText: "Ok, I understand",
        });
        return;
      }

      let leaveData = {
        employee_id: parseInt(employeeData.id),
        reporting_date: formData.reportingDate,
        leave_type: formData.leaveType,
        reason: formData.reason,
        status: "Pending",
        leave_date: null,
        leave_from: null,
        leave_to: null,
        period: null,
        is_half_day: false,
        is_short_leave: false,
        short_leave_slot: null,
        leave_duration: 0
      };

      if (formData.leaveDateType === "fullDay") {
        leaveData.leave_date = formData.leaveDate.single;
        leaveData.is_half_day = false;
        leaveData.leave_duration = 1;
      } else if (formData.leaveDateType === "halfDay") {
        leaveData.leave_date = formData.leaveDate.single;
        leaveData.period =
          formData.halfDayPeriod === "morning" ? "Morning" : "Afternoon";
        leaveData.is_half_day = true;
        leaveData.leave_duration = 0.5;
      } else if (formData.leaveDateType === "shortLeave") {
        leaveData.leave_date = formData.leaveDate.single;
        leaveData.is_short_leave = true;
        leaveData.short_leave_slot = formData.shortLeaveSlot;
        leaveData.leave_duration = 0.25;
      } else if (formData.leaveDateType === "manual") {
        leaveData.leave_from = formData.leaveDate.from;
        leaveData.leave_to = formData.leaveDate.to;
        leaveData.is_half_day = false;

        // Calculate duration for date range
        const fromDate = new Date(formData.leaveDate.from);
        const toDate = new Date(formData.leaveDate.to);
        const timeDiff = toDate.getTime() - fromDate.getTime();
        const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
        leaveData.leave_duration = dayDiff;
      }

      try {
        await createLeave(leaveData);

        // Show success message
        Swal.fire({
          icon: "success",
          title: "Success",
          text: "Leave request submitted successfully!",
          confirmButtonColor: "#3085d6",
        });

        await handleSubmitSuccess();
      } catch (error) {
        // Check if this is a limit exceeded error that allows continuation
        if (
          error.response?.status === 422 &&
          error.response?.data?.limit_exceeded &&
          error.response?.data?.continue_allowed
        ) {
          // Show warning with continue option
          const result = await Swal.fire({
            icon: "warning",
            title: "Leave Limitation",
            html: `
              <div class="text-left">
                <p>${error.response.data.message}</p>
                <p class="mt-3">Do you want to continue with this request anyway?</p>
                <p class="mt-2 text-xs text-gray-500">
                  Note: Continuing will mark this leave with an override status
                </p>
              </div>
            `,
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Continue Anyway",
            cancelButtonText: "Cancel Request",
          });

          if (result.isConfirmed) {
            // User wants to continue - resubmit with force_continue flag
            try {
              await createLeaveWithOverride(leaveData);

              Swal.fire({
                icon: "success",
                title: "Leave Request Submitted",
                text: "Your leave request has been submitted with the noted limitation.",
                confirmButtonColor: "#3085d6",
              });

              await handleSubmitSuccess();
            } catch (innerError) {
              handleSubmitError(innerError);
            }
          } else {
            // User canceled the request
            setIsSubmitting(false);
          }
          return;
        }

        // Handle other errors
        handleSubmitError(error);
      }
    } catch (error) {
      handleSubmitError(error);
    }
  };

  // Add these helper functions for cleaner code
  const handleSubmitSuccess = async () => {
    // Refresh the leave data to show updated balance
    await Promise.all([
      fetchEmployeeLeaves(employeeData.id, employeeData),
      fetchLeaveUsage(employeeData.attendance_employee_no || formData.attendanceNo),
    ]);

    // Dispatch event to notify calendar to refresh
    window.dispatchEvent(new Event('leaveSubmitted'));

    setSubmitSuccess(true);
    setFormData({
      ...formData,
      reportingDate: getCurrentDate(),
      leaveType: "",
      leaveDateType: "fullDay",
      halfDayPeriod: "morning",
      shortLeaveSlot: "slot1",
      leaveDate: {
        single: getCurrentDate(),
        from: getCurrentDate(),
        to: getCurrentDate(),
      },
      reason: "",
      covering_employee_id: "",
    });

    setIsSubmitting(false);
  };

  const handleSubmitError = (error) => {
    console.error("Error submitting leave request:", error);

    // Check for duplicate error
    if (error.response?.status === 422 && error.response?.data?.duplicate_found) {
      Swal.fire({
        icon: "error",
        title: "Duplicate Leave Request",
        text: error.response.data.message,
        confirmButtonColor: "#3085d6",
      });
      setIsSubmitting(false);
      return;
    }

    // Check if the error response contains validation errors
    if (
      error.response?.status === 422 &&
      !error.response?.data?.limit_exceeded
    ) {
      showValidationErrors(error.response.data);
    } else if (error.response?.data?.message) {
      // Show specific error message from the server
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response.data.message,
        confirmButtonColor: "#3085d6",
      });
    } else {
      // Show generic error message
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to submit leave request. Please try again.",
        confirmButtonColor: "#3085d6",
      });
    }

    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 py-4 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4 max-w-7xl">
        
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-4 sm:px-8 py-6 sm:py-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white text-center">
              Leave Master
            </h1>
            <p className="text-blue-100 text-center mt-2 text-sm sm:text-base">
              Employee Leave Management System{" "}
              {formData.attendanceNo && `- EMP No: ${formData.attendanceNo}`}
            </p>
          </div>
          <div className="p-4 sm:p-6 lg:p-8">
            {submitSuccess && (
              <div className="mb-6 bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  <span>Leave request submitted successfully!</span>
                </div>
                <button
                  onClick={() => setSubmitSuccess(false)}
                  className="text-green-700 hover:text-green-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {submitError && (
              <div className="mb-6 bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
                <div className="flex items-center">
                  <X className="w-5 h-5 mr-2" />
                  <span>{submitError}</span>
                </div>
                <button
                  onClick={() => setSubmitError("")}
                  className="text-red-700 hover:text-red-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          EMP number <span className="text-red-500">*</span>
                        </label>
                        <div className="flex">
                          <input
                            type="text"
                            name="attendanceNo"
                            value={formData.attendanceNo}
                            onChange={handleDateChange}
                            required
                            disabled={!!employeeProfile}
                            className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                              employeeProfile ? 'bg-gray-50 text-gray-500' : ''
                            }`}
                            placeholder="Enter employee number"
                          />
                          {!employeeProfile && (
                            <button
                              type="button"
                              className="ml-2 p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                              onClick={fetchEmployeeDetails}
                              disabled={isLoading}
                            >
                              {isLoading ? (
                                <div className="w-5 h-5 border-t-2 border-b-2 border-blue-600 rounded-full animate-spin"></div>
                              ) : (
                                <Search className="w-5 h-5" />
                              )}
                            </button>
                          )}
                        </div>
                        {searchError && (
                          <p className="text-xs text-red-500 mt-1">
                            {searchError}
                          </p>
                        )}
                        {employeeProfile && (
                          <p className="text-xs text-green-600 mt-1">
                            ✓ Logged in as {formData.employeeName}
                          </p>
                        )}
                      </div>
                    
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          EPF No
                        </label>
                        <input
                          type="text"
                          name="epfNo"
                          value={formData.epfNo}
                          disabled
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="EPF number"
                        />
                      </div>
                     
                      <div className="space-y-2 sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Employee Name
                        </label>
                        <input
                          type="text"
                          name="employeeName"
                          value={formData.employeeName}
                          disabled
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="Employee name"
                        />
                      </div>
                     
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Department
                        </label>
                        <input
                          type="text"
                          name="department"
                          value={formData.department}
                          disabled
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="Department"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Reporting Date
                        </label>
                        <input
                          type="date"
                          name="reportingDate"
                          value={formData.reportingDate}
                          disabled
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Leave Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="leaveType"
                          value={formData.leaveType}
                          onChange={handleDateChange}
                          required
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                          disabled={leaveUsageData.length === 0}
                        >
                          <option value="">Select Leave Type</option>
                          {leaveUsageData.map((item) => (
                            <option key={item.leaveType} value={item.leaveType}>
                              {item.leaveType} (Available: {item.balance})
                            </option>
                          ))}
                        </select>
                        {leaveUsageData.length === 0 && formData.employeeName && (
                          <p className="text-xs text-gray-500 mt-1">
                            No leave types available for this employee
                          </p>
                        )}
                      </div>
                    </div>

                   
                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Leave Duration <span className="text-red-500">*</span>
                      </label>
                      <div className="flex flex-wrap gap-4 mb-4">
                        <div className="flex items-center">
                          <input
                            type="radio"
                            id="fullDay"
                            name="leaveDateType"
                            value="fullDay"
                            checked={formData.leaveDateType === "fullDay"}
                            onChange={handleDateChange}
                            className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500"
                          />
                          <label
                            htmlFor="fullDay"
                            className="text-sm text-gray-700"
                          >
                            Full Day
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="radio"
                            id="halfDay"
                            name="leaveDateType"
                            value="halfDay"
                            checked={formData.leaveDateType === "halfDay"}
                            onChange={handleDateChange}
                            className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500"
                          />
                          <label
                            htmlFor="halfDay"
                            className="text-sm text-gray-700"
                          >
                            Half Day
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="radio"
                            id="shortLeave"
                            name="leaveDateType"
                            value="shortLeave"
                            checked={formData.leaveDateType === "shortLeave"}
                            onChange={handleDateChange}
                            className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500"
                          />
                          <label
                            htmlFor="shortLeave"
                            className="text-sm text-gray-700"
                          >
                            Short Leave
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="radio"
                            id="manual"
                            name="leaveDateType"
                            value="manual"
                            checked={formData.leaveDateType === "manual"}
                            onChange={handleDateChange}
                            className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500"
                          />
                          <label
                            htmlFor="manual"
                            className="text-sm text-gray-700"
                          >
                            Date Range
                          </label>
                        </div>
                      </div>

                      {formData.leaveDateType === "fullDay" && (
                        <div className="mb-4 relative">
                          <label className="block text-xs text-gray-500 mb-1">
                            Date
                          </label>
                          <div
                            className="relative"
                            onMouseEnter={() =>
                              setHoveredDate(formData.leaveDate.single)
                            }
                            onMouseLeave={() => setHoveredDate(null)}
                          >
                            <input
                              type="date"
                              name="leaveDate.single"
                              value={formData.leaveDate.single}
                              onChange={handleDateChange}
                              required
                              className={getDateInputStyle(
                                formData.leaveDate.single
                              )}
                              min={getMinLeaveDate()}
                              onKeyDown={(e) => e.preventDefault()}
                            />
                            {hoveredDate === formData.leaveDate.single &&
                              getDateHoverContent(formData.leaveDate.single)}
                          </div>
                          {isDateDisabled(formData.leaveDate.single) && (
                            <p className="mt-1 text-xs text-red-600 flex items-center">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              This date is unavailable for leave
                            </p>
                          )}
                        </div>
                      )}

                      {formData.leaveDateType === "halfDay" && (
                        <div className="space-y-4">
                          <div className="relative">
                            <label className="block text-xs text-gray-500 mb-1">
                              Date
                            </label>
                            <div
                              className="relative"
                              onMouseEnter={() =>
                                setHoveredDate(formData.leaveDate.single)
                              }
                              onMouseLeave={() => setHoveredDate(null)}
                            >
                              <input
                                type="date"
                                name="leaveDate.single"
                                value={formData.leaveDate.single}
                                onChange={handleDateChange}
                                required
                                className={getDateInputStyle(
                                  formData.leaveDate.single
                                )}
                                min={getMinLeaveDate()}
                                onKeyDown={(e) => e.preventDefault()}
                              />
                              {hoveredDate === formData.leaveDate.single &&
                                getDateHoverContent(formData.leaveDate.single)}
                            </div>
                            {isDateDisabled(formData.leaveDate.single) && (
                              <p className="mt-1 text-xs text-red-600 flex items-center">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                This date is unavailable for leave
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              Period
                            </label>
                            <select
                              name="halfDayPeriod"
                              value={formData.halfDayPeriod}
                              onChange={handleDateChange}
                              required
                              className="w-full sm:w-1/2 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            >
                              <option value="morning">Morning</option>
                              <option value="afternoon">Afternoon</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {formData.leaveDateType === "shortLeave" && (
                        <div className="space-y-4">
                          <div className="relative">
                            <label className="block text-xs text-gray-500 mb-1">
                              Date
                            </label>
                            <div
                              className="relative"
                              onMouseEnter={() =>
                                setHoveredDate(formData.leaveDate.single)
                              }
                              onMouseLeave={() => setHoveredDate(null)}
                            >
                              <input
                                type="date"
                                name="leaveDate.single"
                                value={formData.leaveDate.single}
                                onChange={handleDateChange}
                                required
                                className={getDateInputStyle(
                                  formData.leaveDate.single
                                )}
                                min={getMinLeaveDate()}
                                onKeyDown={(e) => e.preventDefault()}
                              />
                              {hoveredDate === formData.leaveDate.single &&
                                getDateHoverContent(formData.leaveDate.single)}
                            </div>
                            {isDateDisabled(formData.leaveDate.single) && (
                              <p className="mt-1 text-xs text-red-600 flex items-center">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                This date is unavailable for leave
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              Time Slot (2 hours)
                            </label>
                            <select
                              name="shortLeaveSlot"
                              value={formData.shortLeaveSlot}
                              onChange={handleDateChange}
                              required
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            >
                              <option value="slot1">8:30 AM - 10:30 AM</option>
                              <option value="slot2">10:30 AM - 12:30 PM</option>
                              <option value="slot3">1:30 PM - 3:30 PM</option>
                              <option value="slot4">3:30 PM - 5:30 PM</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {formData.leaveDateType === "manual" && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="relative">
                            <label className="block text-xs text-gray-500 mb-1">
                              From
                            </label>
                            <div
                              className="relative"
                              onMouseEnter={() =>
                                setHoveredDate(formData.leaveDate.from)
                              }
                              onMouseLeave={() => setHoveredDate(null)}
                            >
                              <input
                                type="date"
                                name="leaveDate.from"
                                value={formData.leaveDate.from}
                                onChange={handleDateChange}
                                required
                                className={getDateInputStyle(
                                  formData.leaveDate.from
                                )}
                                min={getMinLeaveDate()}
                                onKeyDown={(e) => e.preventDefault()}
                              />
                              {hoveredDate === formData.leaveDate.from &&
                                getDateHoverContent(formData.leaveDate.from)}
                            </div>
                            {isDateDisabled(formData.leaveDate.from) && (
                              <p className="mt-1 text-xs text-red-600 flex items-center">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                This date is unavailable for leave
                              </p>
                            )}
                          </div>
                          <div className="relative">
                            <label className="block text-xs text-gray-500 mb-1">
                              To
                            </label>
                            <div
                              className="relative"
                              onMouseEnter={() =>
                                setHoveredDate(formData.leaveDate.to)
                              }
                              onMouseLeave={() => setHoveredDate(null)}
                            >
                              <input
                                type="date"
                                name="leaveDate.to"
                                value={formData.leaveDate.to}
                                onChange={handleDateChange}
                                required
                                className={getDateInputStyle(
                                  formData.leaveDate.to
                                )}
                                min={formData.leaveDate.from}
                                onKeyDown={(e) => e.preventDefault()}
                              />
                              {hoveredDate === formData.leaveDate.to &&
                                getDateHoverContent(formData.leaveDate.to)}
                            </div>
                            {isDateDisabled(formData.leaveDate.to) && (
                              <p className="mt-1 text-xs text-red-600 flex items-center">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                This date is unavailable for leave
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                   
                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reason
                      </label>
                      <textarea
                        name="reason"
                        value={formData.reason}
                        onChange={handleDateChange}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="Reason for leave"
                      ></textarea>
                    </div>

                    <div className="mt-4 text-xs text-gray-500">
                      <p>
                        Marked with <span className="text-red-500">*</span> are
                        required
                      </p>
                    </div>
                  </div>

                  
                  <div className="mt-6 flex justify-end space-x-4">
                    <button
                      type="button"
                      className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                      onClick={() => {
                        setFormData({
                          attendanceNo: "",
                          epfNo: "",
                          employeeName: "",
                          department: "",
                          reportingDate: getCurrentDate(),
                          leaveType: "",
                          leaveDateType: "fullDay",
                          halfDayPeriod: "morning",
                          leaveDate: {
                            single: getCurrentDate(),
                            from: getCurrentDate(),
                            to: getCurrentDate(),
                          },
                          reason: "",
                        });
                        setSearchError("");
                        setSubmitError("");
                        setSubmitSuccess(false);
                        setLeaveRecords([]);
                      }}
                      disabled={isSubmitting}
                    >
                      Clear Form
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 transition-colors shadow-md hover:shadow-lg flex items-center justify-center min-w-[150px]"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin mr-2"></div>
                          <span>Submitting...</span>
                        </>
                      ) : (
                        "Submit Leave Request"
                      )}
                    </button>
                  </div>
                </div>

                
                <div className="space-y-6">
                 
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-medium text-gray-800">
                        Leave Usage Summary
                      </h3>
                      {formData.employeeName && (
                        <span className="text-sm text-gray-600">
                          {formData.employeeName}
                        </span>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      {isLoadingUsage ? (
                        <div className="py-10 text-center">
                          <div className="inline-block w-6 h-6 border-t-2 border-b-2 border-blue-600 rounded-full animate-spin"></div>
                          <p className="mt-2 text-sm text-gray-600">
                            Loading leave usage data...
                          </p>
                        </div>
                      ) : (
                        <table className="min-w-full bg-white border-collapse">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                #
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Leave Type
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Total
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Usage
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Balance
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {leaveUsageData.map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 border text-sm">
                                  {item.id}
                                </td>
                                <td className="px-4 py-3 border text-sm">
                                  {item.leaveType}
                                </td>
                                <td className="px-4 py-3 border text-sm">
                                  {item.total}
                                </td>
                                <td className="px-4 py-3 border text-sm">
                                  {item.usage}
                                </td>
                                <td className="px-4 py-3 border text-sm font-medium text-blue-600">
                                  {item.balance}
                                </td>
                              </tr>
                            ))}
                            {leaveUsageData.length === 0 && !isLoadingUsage && (
                              <tr>
                                <td
                                  colSpan="5"
                                  className="px-4 py-8 border text-center text-gray-500"
                                >
                                  {formData.employeeName
                                    ? "No leave usage data available for this employee"
                                    : "Search for an employee to view leave balances"}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                 
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-medium text-gray-800">
                        Employee Leave Record
                      </h3>
                      {formData.employeeName && (
                        <span className="text-sm text-gray-600">
                          {formData.employeeName}
                        </span>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      {isLoadingLeaves ? (
                        <div className="py-10 text-center">
                          <div className="inline-block w-6 h-6 border-t-2 border-b-2 border-blue-600 rounded-full animate-spin"></div>
                          <p className="mt-2 text-sm text-gray-600">
                            Loading leave records...
                          </p>
                        </div>
                      ) : (
                        <table className="min-w-full bg-white border-collapse">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                #
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Leave Date
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Duration
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Report Date
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Type
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Leave Type
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Status
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                                Limit
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {leaveRecords.map((record) => (
                              <tr key={record.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 border text-sm">
                                  {record.id}
                                </td>
                                <td className="px-4 py-3 border text-sm">
                                  {record.leaveDate}
                                </td>
                                <td className="px-4 py-3 border text-sm">
                                  {record.duration} days
                                </td>
                                <td className="px-4 py-3 border text-sm">
                                  {record.reportDate}
                                </td>
                                <td className="px-4 py-3 border text-sm">
                                  {record.fullHalfDay}
                                </td>
                                <td className="px-4 py-3 border text-sm">
                                  {record.leaveType}
                                </td>
                                <td className="px-4 py-3 border text-sm">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      record.status === "Approved"
                                        ? "bg-green-100 text-green-800"
                                        : record.status === "Rejected"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-yellow-100 text-yellow-800"
                                    }`}
                                  >
                                    {record.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 border text-sm">
                                  {record.hasOverLimit ? (
                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                      Over limit: {record.overLimit}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      Within limit
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {leaveRecords.length === 0 && !isLoadingLeaves && (
                              <tr>
                                <td
                                  colSpan="8"
                                  className="px-4 py-8 border text-center text-gray-500"
                                >
                                  {formData.employeeName
                                    ? "No leave records found for this employee"
                                    : "Search for an employee to view their leave records"}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveMaster;
*/