// ==========================================================================
// SAMEDI GROUP OPERATIONS & FIELD SERVICE CRM — APPLICATION CONTROLLER
// ==========================================================================

class SamediCRM {
  constructor() {
    this.data = this.loadState();
    this.currentView = "dashboard";
    this.selectedCleanerMobile = null;
    this.init();
  }

  // State Persistence via LocalStorage
  loadState() {
    const saved = localStorage.getItem("samedi_crm_state");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved state, loading defaults:", e);
      }
    }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  saveState() {
    localStorage.setItem("samedi_crm_state", JSON.stringify(this.data));
    this.updateBadges();
  }

  // Initialization
  init() {
    this.setupNavigation();
    this.setupGlobalSearch();
    this.renderCurrentView();
    this.populateCleanerSelects();
    this.updateBadges();

    // Setup global button handlers
    document.getElementById("btn-open-quote-calc").addEventListener("click", () => {
      this.openModal("modal-quote-calc");
      this.recalcQuote();
    });

    document.getElementById("btn-quick-new-job").addEventListener("click", () => {
      this.openNewJobModal();
    });

    // Calendar filter
    const boroughSelect = document.getElementById("cal-filter-borough");
    if (boroughSelect) {
      boroughSelect.addEventListener("change", () => this.renderCalendar());
    }

    console.log("Samedi Group CRM initialized successfully.");
  }

  // Navigation Controller
  setupNavigation() {
    const navItems = document.querySelectorAll(".sidebar-nav .nav-item");
    navItems.forEach(item => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const targetView = item.getAttribute("data-view");
        if (targetView) {
          this.switchView(targetView);
        }
      });
    });
  }

  switchView(viewName) {
    this.currentView = viewName;
    document.querySelectorAll(".sidebar-nav .nav-item").forEach(el => {
      el.classList.toggle("active", el.getAttribute("data-view") === viewName);
    });

    document.querySelectorAll(".crm-view").forEach(view => {
      view.classList.toggle("active", view.id === `view-${viewName}`);
    });

    const titles = {
      dashboard: { title: "Operations Command Center", desc: "Live dispatch, commercial contracts, and incoming inquiries across London" },
      leads: { title: "Quote & Ingestion Pipeline", desc: "Real-time leads from samedigroup.co.uk contact forms and booking inquiries" },
      schedule: { title: "Dispatch & Schedule Calendar", desc: "Cleaner fleet roster, Airbnb turnover windows (10:00 - 15:00), and commercial contracts" },
      cleaners: { title: "Cleaners & Field Staff", desc: "DBS compliance, skill sets, live on-shift status, and mobile job cards" },
      invoices: { title: "Invoices & Stripe Live Payments", desc: "UK statutory invoicing, VAT compliance, and Stripe live settlements" },
      integrations: { title: "Website Webhooks & Sync", desc: "Real-time sync resolving issues discovered during website audit" }
    };

    const header = titles[viewName] || titles.dashboard;
    document.getElementById("current-view-title").innerText = header.title;
    document.getElementById("current-view-desc").innerText = header.desc;

    this.renderCurrentView();
  }

  renderCurrentView() {
    switch (this.currentView) {
      case "dashboard":
        this.renderDashboard();
        break;
      case "leads":
        this.renderKanban();
        break;
      case "schedule":
        this.renderCalendar();
        break;
      case "cleaners":
        this.renderCleaners();
        break;
      case "invoices":
        this.renderInvoices();
        break;
      case "integrations":
        // Static view with interactive buttons
        break;
    }
  }

  updateBadges() {
    const leadsCount = this.data.leads.length;
    const jobsCount = this.data.jobs.length;
    const applicantsCount = this.data.cleaners.filter(c => c.status.includes("Applicant")).length;

    const bLeads = document.getElementById("badge-leads");
    if (bLeads) bLeads.innerText = leadsCount;

    const bJobs = document.getElementById("badge-jobs");
    if (bJobs) bJobs.innerText = jobsCount;

    const bCleaners = document.getElementById("badge-cleaner-alert");
    if (bCleaners) {
      if (applicantsCount > 0) {
        bCleaners.style.display = "inline-block";
        bCleaners.innerText = `${applicantsCount} New`;
      } else {
        bCleaners.style.display = "none";
      }
    }
  }

  // ==========================================================================
  // VIEW 1: DASHBOARD
  // ==========================================================================
  renderDashboard() {
    const tbody = document.getElementById("dash-jobs-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const today = "2026-09-27";
    const todayJobs = this.data.jobs.filter(j => j.date === today || true).slice(0, 5);

    todayJobs.forEach(job => {
      const tr = document.createElement("tr");
      const statusClass = job.status === "In Progress" ? "tag-amber" : (job.status === "Completed" ? "tag-green" : "tag-residential");
      const serviceTagClass = job.service.includes("Commercial") ? "tag-commercial" : (job.service.includes("Airbnb") ? "tag-airbnb" : "tag-residential");

      tr.innerHTML = `
        <td>
          <div style="font-weight: 700; color: #FFFFFF;">${job.time}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${job.borough}</div>
        </td>
        <td>
          <div style="font-weight: 700;">${job.title}</div>
          <div style="font-size: 11px; color: var(--text-secondary);">${job.client} • <span class="tag ${serviceTagClass}">${job.service.split(' ')[0]}</span></div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--bg-card-elevated); border: 1px solid var(--gold-primary); display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--gold-light); font-weight: 800;">
              ${job.cleanerName.split(' ').map(n=>n[0]).join('')}
            </div>
            <span style="font-weight: 600; color: var(--text-main);">${job.cleanerName}</span>
          </div>
        </td>
        <td>
          <div style="font-weight: 800; color: var(--gold-light);">£${job.amount.toFixed(2)}</div>
          <div style="font-size: 10px; color: var(--accent-green);">${job.paid ? '✓ Paid' : 'Pending'}</div>
        </td>
        <td>
          <span class="tag ${statusClass}">${job.status}</span>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="app.openCleanerMobile('${job.id}')">
            Mobile Card
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Render Recent Inquiries List
    const leadsList = document.getElementById("dash-leads-list");
    if (leadsList) {
      leadsList.innerHTML = "";
      this.data.leads.slice(0, 3).forEach(lead => {
        const item = document.createElement("div");
        item.style.cssText = "background: var(--bg-input); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-light);";
        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
            <strong style="color: #FFFFFF; font-size: 13px;">${lead.name}</strong>
            <span style="font-weight: 800; color: var(--gold-light); font-size: 12px;">£${lead.budget}</span>
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px;">
            ${lead.propertyType} • ${lead.borough}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="tag tag-airbnb">${lead.source}</span>
            <button class="btn btn-primary btn-sm" onclick="app.quickConvertLead('${lead.id}')">Send Quote</button>
          </div>
        `;
        leadsList.appendChild(item);
      });
    }
  }

  // ==========================================================================
  // VIEW 2: LEADS & KANBAN PIPELINE
  // ==========================================================================
  renderKanban() {
    const stages = ["new", "quote_sent", "survey", "contract_signed"];
    
    stages.forEach(stage => {
      const container = document.getElementById(`kanban-${stage}`);
      const countEl = document.getElementById(`count-${stage.replace('_', '-')}`);
      if (!container) return;
      container.innerHTML = "";

      const leadsInStage = this.data.leads.filter(l => l.stage === stage);
      if (countEl) countEl.innerText = leadsInStage.length;

      leadsInStage.forEach(lead => {
        const card = document.createElement("div");
        card.className = "lead-card";
        const tagClass = lead.type === "Commercial" ? "tag-commercial" : (lead.type.includes("Airbnb") ? "tag-airbnb" : "tag-residential");

        card.innerHTML = `
          <div class="lead-card-header">
            <div>
              <div class="lead-name">${lead.name}</div>
              <div class="lead-company">${lead.company}</div>
            </div>
            <span class="tag ${tagClass}">${lead.type.split(' ')[0]}</span>
          </div>
          <div class="lead-details">
            <div>📍 <strong>${lead.borough}</strong></div>
            <div>🧹 ${lead.service}</div>
            <div style="color: var(--text-muted); font-size: 10.5px; margin-top: 4px;">"${lead.notes}"</div>
          </div>
          <div class="lead-footer">
            <span class="lead-budget">£${lead.budget.toFixed(2)}</span>
            <div style="display: flex; gap: 4px;">
              ${stage !== 'contract_signed' ? `<button class="btn btn-secondary btn-sm" onclick="app.advanceLeadStage('${lead.id}')" title="Move to next stage">➔ Move</button>` : `<span class="tag tag-green">✓ Won</span>`}
            </div>
          </div>
        `;
        container.appendChild(card);
      });
    });
  }

  advanceLeadStage(leadId) {
    const lead = this.data.leads.find(l => l.id === leadId);
    if (!lead) return;

    const stages = ["new", "quote_sent", "survey", "contract_signed"];
    const currIdx = stages.indexOf(lead.stage);
    if (currIdx < stages.length - 1) {
      lead.stage = stages[currIdx + 1];
      this.saveState();
      this.renderKanban();
      this.showToast(`Lead "${lead.name}" moved to ${lead.stage.replace('_', ' ').toUpperCase()}`);

      if (lead.stage === "contract_signed") {
        this.showToast(`🎉 Contract Signed! Creating scheduled job for ${lead.name}`);
        this.convertLeadToJob(lead);
      }
    }
  }

  convertLeadToJob(lead) {
    const newJob = {
      id: `job-${Date.now().toString().slice(-4)}`,
      title: `${lead.propertyType} — ${lead.service}`,
      client: lead.name,
      service: lead.service,
      address: `${lead.propertyType}, ${lead.borough}`,
      borough: lead.borough,
      date: "2026-09-29",
      time: "10:00 - 14:00",
      cleanerId: "cleaner-1",
      cleanerName: "Sarah Jenkins",
      status: "Scheduled",
      amount: lead.budget,
      paid: true,
      paymentMethod: "Stripe Card on File",
      checkInCode: "Key in lockbox or concierge",
      checklist: [
        { task: "Initial thorough walkthrough with client notes", done: false },
        { task: "Sanitise and deep clean all target areas", done: false },
        { task: "Checklist sign-off & customer satisfaction check", done: false }
      ]
    };
    this.data.jobs.unshift(newJob);
    this.saveState();
  }

  // ==========================================================================
  // VIEW 3: DISPATCH CALENDAR
  // ==========================================================================
  renderCalendar() {
    const grid = document.getElementById("calendar-grid");
    if (!grid) return;

    // Retain only the header cells
    const headers = grid.querySelectorAll(".schedule-header-cell");
    grid.innerHTML = "";
    headers.forEach(h => grid.appendChild(h));

    const boroughFilter = document.getElementById("cal-filter-borough") ? document.getElementById("cal-filter-borough").value : "all";

    const times = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
    const days = ["2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"];

    times.forEach(timeSlot => {
      // Time label cell
      const timeCell = document.createElement("div");
      timeCell.className = "time-col-cell";
      timeCell.innerText = timeSlot;
      grid.appendChild(timeCell);

      // 5 day cells
      days.forEach(day => {
        const slotCell = document.createElement("div");
        slotCell.className = "slot-cell";

        // Find jobs in this time slot & day
        const matchingJobs = this.data.jobs.filter(j => {
          const matchBorough = boroughFilter === "all" || j.borough.toLowerCase().includes(boroughFilter.toLowerCase());
          return matchBorough && j.date === day && j.time.startsWith(timeSlot.slice(0, 2));
        });

        matchingJobs.forEach(job => {
          const pill = document.createElement("div");
          pill.className = "job-pill";
          if (job.service.includes("Airbnb")) {
            pill.style.borderLeftColor = "var(--gold-primary)";
          } else if (job.service.includes("Commercial")) {
            pill.style.borderLeftColor = "var(--accent-purple)";
          }

          pill.innerHTML = `
            <div class="job-pill-title">${job.title}</div>
            <div class="job-pill-sub">${job.cleanerName} • £${job.amount}</div>
          `;
          pill.addEventListener("click", () => this.openCleanerMobile(job.id));
          slotCell.appendChild(pill);
        });

        // Click to add new job at this slot
        slotCell.addEventListener("dblclick", () => {
          this.openNewJobModal(day, `${timeSlot} - ${parseInt(timeSlot)+3}:00`);
        });

        grid.appendChild(slotCell);
      });
    });
  }

  // ==========================================================================
  // VIEW 4: CLEANERS FLEET
  // ==========================================================================
  renderCleaners() {
    const grid = document.getElementById("cleaners-roster-grid");
    if (!grid) return;
    grid.innerHTML = "";

    this.data.cleaners.forEach(cleaner => {
      const card = document.createElement("div");
      card.className = "cleaner-card";

      const isApplicant = cleaner.status.includes("Applicant");
      const dbsTagClass = cleaner.dbsStatus.includes("Verified") ? "tag-green" : "tag-amber";

      card.innerHTML = `
        <div>
          <div class="cleaner-header">
            <img src="${cleaner.avatar}" class="cleaner-avatar" alt="${cleaner.name}">
            <div>
              <div class="cleaner-name">${cleaner.name}</div>
              <div class="cleaner-role">${cleaner.role}</div>
              <div class="cleaner-rating">★ ${cleaner.rating > 0 ? cleaner.rating.toFixed(1) : 'New'} (${cleaner.jobsCompleted} cleans)</div>
            </div>
          </div>

          <div class="cleaner-meta-row">
            <span>DBS Background Check</span>
            <span class="tag ${dbsTagClass}">${cleaner.dbsStatus}</span>
          </div>
          <div class="cleaner-meta-row">
            <span>Identity & Right to Work</span>
            <span style="color: ${cleaner.idVerified ? 'var(--accent-green)' : 'var(--accent-amber)'}; font-weight: 700;">
              ${cleaner.idVerified ? '✓ UK Passport Verified' : '⚠️ Pending Verification'}
            </span>
          </div>
          <div class="cleaner-meta-row">
            <span>Coverage Boroughs</span>
            <strong>${cleaner.boroughs.join(', ')}</strong>
          </div>
          <div class="cleaner-meta-row">
            <span>Pay Rate</span>
            <strong style="color: var(--gold-light);">£${cleaner.hourlyRate.toFixed(2)} / hour</strong>
          </div>

          <div class="cleaner-skills">
            ${cleaner.skills.map(s => `<span class="skill-chip">${s}</span>`).join('')}
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 14px;">
          ${isApplicant ? 
            `<button class="btn btn-primary btn-sm" style="flex: 1;" onclick="app.approveCleanerApplicant('${cleaner.id}')">Approve & Verify DBS</button>` :
            `<button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="app.openCleanerDirectMobile('${cleaner.id}')">📱 Cleaner Mobile App</button>
             <button class="btn btn-secondary btn-sm" onclick="app.showToast('Calling ${cleaner.name}: ${cleaner.phone}')">📞 Call</button>`
          }
        </div>
      `;
      grid.appendChild(card);
    });
  }

  approveCleanerApplicant(cleanerId) {
    const cleaner = this.data.cleaners.find(c => c.id === cleanerId);
    if (!cleaner) return;
    cleaner.status = "Active";
    cleaner.dbsStatus = "Verified (Enhanced DBS)";
    cleaner.idVerified = true;
    cleaner.role = "Commercial & Residential Specialist";
    this.saveState();
    this.renderCleaners();
    this.showToast(`✓ Applicant ${cleaner.name} approved and activated in field roster!`);
  }

  // ==========================================================================
  // VIEW 5: INVOICES & STRIPE BILLING
  // ==========================================================================
  renderInvoices() {
    const tbody = document.getElementById("invoices-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    this.data.invoices.forEach(inv => {
      const tr = document.createElement("tr");
      const statusClass = inv.status === "Paid" ? "tag-green" : (inv.status === "Sent" ? "tag-amber" : "tag-residential");

      tr.innerHTML = `
        <td><strong style="font-family: var(--font-mono); color: var(--gold-light);">${inv.id}</strong></td>
        <td>
          <div style="font-weight: 700; color: #FFFFFF;">${inv.clientName}</div>
          <div style="font-size: 11px; color: var(--text-secondary);">${inv.company}</div>
        </td>
        <td>
          <div style="font-size: 12px;">${inv.date}</div>
          <div style="font-size: 10.5px; color: var(--text-muted);">Due: ${inv.dueDate}</div>
        </td>
        <td>
          <div style="font-weight: 800; color: #FFFFFF;">£${inv.total.toFixed(2)}</div>
          <div style="font-size: 10.5px; color: var(--text-muted);">(Net: £${inv.subtotal.toFixed(2)} + VAT: £${inv.vat.toFixed(2)})</div>
        </td>
        <td>
          <span class="code" style="font-size: 10px;">${inv.stripeSessionId}</span>
        </td>
        <td>
          <span class="tag ${statusClass}">${inv.status}</span>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="app.viewInvoice('${inv.id}')">View / Print</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  viewInvoice(invId) {
    const inv = this.data.invoices.find(i => i.id === invId);
    if (!inv) return;

    const modalBody = document.getElementById("invoice-printable-body");
    modalBody.innerHTML = `
      <div style="background: #FFFFFF; color: #0F172A; padding: 24px; border-radius: 8px; font-family: 'Plus Jakarta Sans', sans-serif;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0F172A; padding-bottom: 14px; margin-bottom: 18px;">
          <div>
            <h2 style="font-size: 20px; font-weight: 800; color: #1B2E1B; margin: 0;">SAMEDI GROUP</h2>
            <div style="font-size: 11px; color: #64748B;">Premium Cleaning & Facilities London</div>
            <div style="font-size: 10px; color: #64748B;">Company No: ${this.data.company.crn} • VAT No: ${this.data.company.vat}</div>
          </div>
          <div style="text-align: right;">
            <h3 style="font-size: 16px; font-weight: 800; color: #C9A84C; margin: 0;">TAX INVOICE</h3>
            <div style="font-size: 12px; font-weight: 700; color: #0F172A;">${inv.id}</div>
            <div style="font-size: 11px; color: #64748B;">Date: ${inv.date}</div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px;">
          <div>
            <div style="font-weight: 700; color: #64748B; font-size: 10px; text-transform: uppercase;">Billed To:</div>
            <div style="font-weight: 800; color: #0F172A; font-size: 13px;">${inv.clientName}</div>
            <div>${inv.company}</div>
            <div>${inv.email}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 700; color: #64748B; font-size: 10px; text-transform: uppercase;">Payment Terms:</div>
            <div>Due Date: <strong>${inv.dueDate}</strong></div>
            <div>Status: <span style="background: ${inv.status==='Paid'?'#DEF7EC':'#FEF08A'}; color: ${inv.status==='Paid'?'#03543F':'#854D0E'}; padding: 2px 6px; border-radius: 4px; font-weight: 700;">${inv.status}</span></div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px;">
          <thead>
            <tr style="background: #F1F5F9; border-bottom: 1px solid #CBD5E1;">
              <th style="padding: 8px 10px; text-align: left; color: #475569;">Description</th>
              <th style="padding: 8px 10px; text-align: center; color: #475569;">Qty</th>
              <th style="padding: 8px 10px; text-align: right; color: #475569;">Rate</th>
              <th style="padding: 8px 10px; text-align: right; color: #475569;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${inv.items.map(item => `
              <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 8px 10px; font-weight: 600; color: #1E293B;">${item.desc}</td>
                <td style="padding: 8px 10px; text-align: center; color: #64748B;">${item.qty}</td>
                <td style="padding: 8px 10px; text-align: right; color: #64748B;">£${item.rate.toFixed(2)}</td>
                <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: #1E293B;">£${item.total.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="display: flex; justify-content: flex-end; margin-bottom: 18px;">
          <div style="width: 220px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between; padding: 4px 0;">
              <span>Subtotal:</span>
              <span>£${inv.subtotal.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 4px 0;">
              <span>UK VAT (20%):</span>
              <span>£${inv.vat.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 6px 0; border-top: 2px solid #0F172A; font-weight: 800; font-size: 14px; color: #1B2E1B;">
              <span>Total Payable:</span>
              <span>£${inv.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div style="border-top: 1px solid #E2E8F0; padding-top: 12px; font-size: 10px; color: #64748B; display: flex; justify-content: space-between;">
          <div>Bank: Barclays Bank UK • Sort Code: 20-00-00 • Acc: 83921049</div>
          <div>Stripe Live Settlement ID: ${inv.stripeSessionId}</div>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px;">
        <button class="btn btn-secondary" onclick="window.print()">🖨️ Print / Save as PDF</button>
        <button class="btn btn-primary" onclick="app.closeModal('modal-invoice-view')">Close</button>
      </div>
    `;

    this.openModal("modal-invoice-view");
  }

  toggleStripeLiveMode() {
    this.data.company.stripeMode = this.data.company.stripeMode === "live" ? "test" : "live";
    this.saveState();
    const ind = document.getElementById("stripe-mode-indicator");
    if (ind) {
      ind.innerHTML = `Stripe Mode: <strong>${this.data.company.stripeMode.toUpperCase()}</strong>`;
    }
    this.showToast(`Switched Stripe integration to ${this.data.company.stripeMode.toUpperCase()} mode!`);
  }

  // ==========================================================================
  // SMART QUOTE CALCULATOR LOGIC
  // ==========================================================================
  recalcQuote() {
    const serviceType = document.getElementById("calc-service").value;
    const propertyScale = document.getElementById("calc-size").value;

    const baseRates = {
      residential: 18.00,
      deep: 28.00,
      tenancy: 25.00,
      airbnb: 22.00,
      commercial: 22.00
    };

    const hourMultipliers = {
      "1": 2.0,
      "2": 3.0,
      "3": 4.5,
      "4": 6.0,
      "5": 8.0,
      "office_sm": 10.0,
      "office_lg": 25.0
    };

    const rate = baseRates[serviceType] || 20.00;
    const hours = hourMultipliers[propertyScale] || 4.0;
    let total = rate * hours;

    if (document.getElementById("calc-addon-oven")?.checked) total += 55.00;
    if (document.getElementById("calc-addon-carpet")?.checked) total += 75.00;
    if (document.getElementById("calc-addon-linen")?.checked) total += 25.00;
    if (document.getElementById("calc-addon-eco")?.checked) total += 20.00;

    document.getElementById("calc-total-display").innerText = `£${total.toFixed(2)}`;
    document.getElementById("calc-hours-display").innerText = `Approx. ${hours} man-hours @ £${rate}/h`;
  }

  convertCalcToLead() {
    const service = document.getElementById("calc-service").selectedOptions[0].text.split('(')[0].trim();
    const total = parseFloat(document.getElementById("calc-total-display").innerText.replace('£', ''));

    const newLead = {
      id: `lead-${Date.now().toString().slice(-4)}`,
      name: "Calculator Inquiry",
      company: "Private Client",
      email: "inquiry@client.co.uk",
      phone: "07700 900888",
      type: service.includes("Commercial") ? "Commercial" : "Residential",
      propertyType: document.getElementById("calc-size").selectedOptions[0].text,
      borough: "Westminster & Central London",
      service: service,
      budget: total,
      frequency: "One-Off / Quote Requested",
      stage: "quote_sent",
      source: "Smart Calculator",
      notes: "Auto-generated quote from operations calculator with add-ons.",
      createdAt: new Date().toISOString()
    };

    this.data.leads.unshift(newLead);
    this.saveState();
    this.closeModal("modal-quote-calc");
    this.switchView("leads");
    this.showToast(`✓ New Quote lead generated (£${total.toFixed(2)}) & added to pipeline!`);
  }

  // ==========================================================================
  // CLEANER MOBILE PREVIEW SIMULATOR
  // ==========================================================================
  openCleanerMobile(jobId) {
    const job = this.data.jobs.find(j => j.id === jobId) || this.data.jobs[0];
    if (!job) return;

    document.getElementById("mobile-job-title").innerText = job.title;
    document.getElementById("mobile-job-addr").innerText = job.address;
    document.getElementById("mobile-job-access").innerText = `🔑 ${job.checkInCode}`;
    document.getElementById("mobile-cleaner-status").innerText = job.status;

    const checklistContainer = document.getElementById("mobile-checklist-area");
    checklistContainer.innerHTML = "";

    job.checklist.forEach((item, idx) => {
      const div = document.createElement("div");
      div.className = `checklist-item ${item.done ? 'checked' : ''}`;
      div.innerHTML = `
        <input type="checkbox" ${item.done ? 'checked' : ''} onchange="app.toggleChecklistItem('${job.id}', ${idx}, this.checked)">
        <span>${item.task}</span>
      `;
      checklistContainer.appendChild(div);
    });

    this.selectedCleanerMobile = job.id;
    this.openModal("modal-cleaner-mobile");
  }

  openCleanerDirectMobile(cleanerId) {
    const job = this.data.jobs.find(j => j.cleanerId === cleanerId) || this.data.jobs[0];
    this.openCleanerMobile(job.id);
  }

  toggleChecklistItem(jobId, idx, isChecked) {
    const job = this.data.jobs.find(j => j.id === jobId);
    if (job && job.checklist[idx]) {
      job.checklist[idx].done = isChecked;
      this.saveState();
      this.openCleanerMobile(jobId);
    }
  }

  simulatePhotoUpload() {
    this.showToast("📷 4 Quality inspection photos uploaded to Samedi Cloud!");
  }

  completeMobileClean() {
    const job = this.data.jobs.find(j => j.id === this.selectedCleanerMobile);
    if (job) {
      job.status = "Completed";
      job.checklist.forEach(item => item.done = true);
      this.saveState();
      this.closeModal("modal-cleaner-mobile");
      this.renderCurrentView();
      this.showToast(`🎉 Job "${job.title}" marked COMPLETED! Client invoice dispatched.`);
    }
  }

  // ==========================================================================
  // DISPATCH NEW JOB MODAL
  // ==========================================================================
  openNewJobModal(date, time) {
    if (date) document.getElementById("job-date").value = date;
    if (time) document.getElementById("job-time").value = time;
    this.populateCleanerSelects();
    this.openModal("modal-new-job");
  }

  populateCleanerSelects() {
    const sel = document.getElementById("job-cleaner-select");
    if (!sel) return;
    sel.innerHTML = "";
    this.data.cleaners.filter(c => c.status === "Active" || c.status === "On Shift").forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.innerText = `${c.name} (${c.role.split(' ')[0]}) - £${c.hourlyRate}/h`;
      sel.appendChild(opt);
    });
  }

  handleNewJobSubmit(e) {
    e.preventDefault();
    const title = document.getElementById("job-title").value;
    const client = document.getElementById("job-client").value;
    const service = document.getElementById("job-service").value;
    const address = document.getElementById("job-address").value;
    const date = document.getElementById("job-date").value;
    const time = document.getElementById("job-time").value;
    const cleanerId = document.getElementById("job-cleaner-select").value;
    const amount = parseFloat(document.getElementById("job-amount").value);
    const access = document.getElementById("job-access").value;

    const cleaner = this.data.cleaners.find(c => c.id === cleanerId);

    const newJob = {
      id: `job-${Date.now().toString().slice(-4)}`,
      title,
      client,
      service,
      address,
      borough: address.split(',').pop().trim() || "London",
      date,
      time,
      cleanerId,
      cleanerName: cleaner ? cleaner.name : "Sarah Jenkins",
      status: "Scheduled",
      amount,
      paid: true,
      paymentMethod: "Stripe Online",
      checkInCode: access || "Standard key handover",
      checklist: [
        { task: "Arrival on site and key access check", done: false },
        { task: "Execute high-touch sanitisation protocols", done: false },
        { task: "Final inspection & departure locking check", done: false }
      ]
    };

    this.data.jobs.unshift(newJob);
    this.saveState();
    this.closeModal("modal-new-job");
    this.renderCurrentView();
    this.showToast(`✓ Job scheduled and dispatched to ${newJob.cleanerName}!`);
  }

  // ==========================================================================
  // WEBHOOK & WEBSITE SIMULATORS
  // ==========================================================================
  simulateWebsiteLead() {
    const sampleLeads = [
      {
        name: "Charlotte Beaumont",
        company: "Canary Wharf Financial Corp",
        email: "c.beaumont@canarywharfcorp.co.uk",
        phone: "020 7946 8821",
        type: "Commercial",
        propertyType: "Bank Street Office (6,000 sq ft)",
        borough: "Canary Wharf / Tower Hamlets (E14)",
        service: "Nightly Corporate Maintenance",
        budget: 3200,
        frequency: "Daily Contract",
        stage: "new",
        source: "Website Contact Form (/contact)",
        notes: "Need proposal for 7 cleaners 5 nights a week. Urgent start next week."
      },
      {
        name: "Alexander Vance",
        company: "Private",
        email: "alex.vance@gmail.com",
        phone: "07988 543210",
        type: "Airbnb / Short-Let",
        propertyType: "Luxury 2-Bed Flat",
        borough: "Covent Garden (WC2E)",
        service: "Airbnb Turnover & Restock",
        budget: 140,
        frequency: "3x per week",
        stage: "new",
        source: "Website Airbnb Booking",
        notes: "Key in keycafe at local store. Needs linen service."
      }
    ];

    const pick = sampleLeads[Math.floor(Math.random() * sampleLeads.length)];
    const lead = {
      ...pick,
      id: `lead-${Date.now().toString().slice(-4)}`,
      createdAt: new Date().toISOString()
    };

    this.data.leads.unshift(lead);
    this.saveState();
    this.showToast(`⚡ Live Webhook: New lead from ${lead.name} (${lead.source})!`);
    this.renderCurrentView();
  }

  simulateCleanerApplication() {
    const applicant = {
      id: `cleaner-${Date.now().toString().slice(-4)}`,
      name: "Hannah Lindqvist",
      role: "Applicant — Luxury Housekeeper",
      rating: 0.0,
      jobsCompleted: 0,
      phone: "07890 123789",
      email: "hannah.l@yahoo.co.uk",
      boroughs: ["Chelsea", "Battersea", "Clapham"],
      skills: ["Hotel Housekeeping", "Linen Pressing", "VIP Client Discretion"],
      status: "Applicant Awaiting Vetting",
      dbsStatus: "Awaiting Document Upload",
      idVerified: false,
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
      hourlyRate: 18.00
    };

    this.data.cleaners.push(applicant);
    this.saveState();
    this.showToast(`⚡ Webhook (/careers/cleaners): New job application from ${applicant.name}!`);
    this.renderCurrentView();
  }

  simulateStripePayment() {
    const paidInv = this.data.invoices.find(i => i.status !== "Paid") || this.data.invoices[0];
    paidInv.status = "Paid";
    paidInv.stripeSessionId = `cs_live_${Date.now().toString(36)}`;
    this.saveState();
    this.showToast(`💳 Stripe Webhook: Invoice ${paidInv.id} paid (£${paidInv.total.toFixed(2)})!`);
    this.renderCurrentView();
  }

  // ==========================================================================
  // MODAL UTILITIES
  // ==========================================================================
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add("open");
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove("open");
  }

  // Toast System
  showToast(message) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
      <div class="pulse-dot"></div>
      <div>${message}</div>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(50px)";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  setupGlobalSearch() {
    const input = document.getElementById("global-search");
    if (!input) return;
    input.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        this.renderCurrentView();
        return;
      }
      // Simple search across jobs & leads
      if (this.currentView === "dashboard" || this.currentView === "schedule") {
        const filtered = this.data.jobs.filter(j => 
          j.title.toLowerCase().includes(q) || 
          j.client.toLowerCase().includes(q) || 
          j.borough.toLowerCase().includes(q) ||
          j.cleanerName.toLowerCase().includes(q)
        );
        const tbody = document.getElementById("dash-jobs-tbody");
        if (tbody) {
          tbody.innerHTML = "";
          filtered.forEach(job => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td><strong>${job.time}</strong><br><small>${job.borough}</small></td>
              <td>${job.title}<br><small>${job.client}</small></td>
              <td>${job.cleanerName}</td>
              <td>£${job.amount}</td>
              <td><span class="tag tag-green">${job.status}</span></td>
              <td><button class="btn btn-secondary btn-sm" onclick="app.openCleanerMobile('${job.id}')">View</button></td>
            `;
            tbody.appendChild(tr);
          });
        }
      }
    });
  }
}

// Global App Instance
let app;
window.addEventListener("DOMContentLoaded", () => {
  app = new SamediCRM();
});
